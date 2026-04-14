#!/usr/bin/env python3
"""
Prepare a flat map for react-globe.gl / equirectangular globeImageUrl:
- Resize to exact 2:1 (width = 2 * height)
- Optional horizontal roll (move the seam to open ocean / simpler sky)
- Wide symmetric seam blend so left/right edges meet smoothly (not just 1 column)
- Light pole feather between first/last rows

Setup (once, from repo root):
  python3 -m venv .venv
  source .venv/bin/activate   # Windows: .venv\\Scripts\\activate
  pip install -r scripts/requirements.txt

Run:
  .venv/bin/python scripts/process_globe_texture.py
  .venv/bin/python scripts/process_globe_texture.py --roll 0.15 --seam-width 120
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image


def roll_longitude(arr: np.ndarray, shift_px: int) -> np.ndarray:
    """Shift columns (wrap) so the antimeridian seam sits elsewhere on the art."""
    if shift_px == 0:
        return arr
    return np.roll(arr, shift_px, axis=1)


def apply_seam_blend(arr: np.ndarray, band: int) -> None:
    """
    Columns k and W-1-k are the same meridian on a sphere; blend them inward
    so the transition isn't a1-pixel cliff.
    Mutates arr (H, W, 3) uint8.
    """
    _h, w, _c = arr.shape
    band = max(1, min(band, w // 2 - 1))
    denom = max(band - 1, 1)

    for k in range(band):
        a = k / denom
        left_idx = k
        right_idx = w - 1 - k
        left = arr[:, left_idx, :].astype(np.float32)
        right = arr[:, right_idx, :].astype(np.float32)
        mid = (left + right) * 0.5
        arr[:, left_idx, :] = np.clip(left * a + mid * (1.0 - a), 0, 255).astype(np.uint8)
        arr[:, right_idx, :] = np.clip(right * a + mid * (1.0 - a), 0, 255).astype(np.uint8)

    # Exact equality on the shared meridian (avoids GPU filtering cracks)
    arr[:, -1, :] = arr[:, 0, :]


def apply_pole_feather(arr: np.ndarray, band: int) -> None:
    """Blend north/south edge rows to soften the polar pinch."""
    h, _w, _c = arr.shape
    band = max(1, min(band, h // 2 - 1))
    denom = max(band - 1, 1)

    for r in range(band):
        t = r / denom
        top = arr[r, :, :].astype(np.float32)
        bottom = arr[h - 1 - r, :, :].astype(np.float32)
        mid = (top + bottom) * 0.5
        arr[r, :, :] = np.clip(top * t + mid * (1.0 - t), 0, 255).astype(np.uint8)
        arr[h - 1 - r, :, :] = np.clip(bottom * t + mid * (1.0 - t), 0, 255).astype(np.uint8)


def main() -> None:
    root = Path(__file__).resolve().parent.parent
    default_in = root / "public" / "assets" / "images" / "world.png"
    default_out = root / "public" / "assets" / "images" / "world-equirectangular.png"

    p = argparse.ArgumentParser(description="Equirectangular 2:1 globe texture prep")
    p.add_argument("--input", type=Path, default=default_in, help="Source image path")
    p.add_argument("--output", type=Path, default=default_out, help="Output PNG path")
    p.add_argument(
        "--roll",
        type=float,
        default=0.0,
        help="Fraction of width to roll horizontally (0–1), e.g. 0.2 moves seam to another longitude",
    )
    p.add_argument(
        "--seam-width",
        type=int,
        default=0,
        help="Pixels to blend at the wrap seam (0 = auto ~3%% of width, min 32)",
    )
    p.add_argument(
        "--pole-band",
        type=int,
        default=4,
        help="Rows to feather at north/south edges",
    )
    args = p.parse_args()

    if not args.input.is_file():
        raise SystemExit(f"Input not found: {args.input}")

    img = Image.open(args.input).convert("RGB")
    _w, h = img.size

    target_h = h
    target_w = 2 * target_h

    img_resized = img.resize((target_w, target_h), Image.Resampling.BICUBIC)
    arr = np.array(img_resized)

    roll_px = int((args.roll % 1.0) * target_w)
    if roll_px:
        arr = roll_longitude(arr, roll_px)

    seam = args.seam_width if args.seam_width > 0 else max(32, target_w // 32)
    apply_seam_blend(arr, seam)
    apply_pole_feather(arr, max(1, args.pole_band))

    final = Image.fromarray(arr.astype(np.uint8))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    final.save(args.output, optimize=True)
    print(
        f"Wrote {args.output} ({final.size[0]}×{final.size[1]}, 2:1, seam_blend={seam}px, roll={roll_px}px)"
    )


if __name__ == "__main__":
    main()
