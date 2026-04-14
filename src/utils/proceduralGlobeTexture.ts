import { terrainValue, fbm } from './terrain';

function mix(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

function smoothstep(a: number, b: number, x: number) {
  return clamp01((x - a) / (b - a));
}

/**
 * Builds a data URL for an equirectangular texture usable as react-globe.gl `globeImageUrl`.
 */
export function createProceduralGlobeTextureDataUrl(): string {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  const w = canvas.width;
  const h = canvas.height;

  const oceanDeep = [7, 8, 26];
  const oceanNear = [70, 110, 140];
  const sand = [237, 224, 191];
  const moss = [110, 160, 90];
  const midland = [200, 160, 110];

  const img = ctx.createImageData(w, h);

  function clamp(v: number, a = 0, b = 255) {
    return Math.max(a, Math.min(b, v));
  }

  for (let y = 0; y < h; y++) {
    const lat = 90 - (y / (h - 1)) * 180;
    for (let x = 0; x < w; x++) {
      const lon = (x / (w - 1)) * 360 - 180;
      const t = terrainValue(lat, lon);
      const px = (y * w + x) * 4;
      const landThresh = 0.05;

      if (t > landThresh) {
        const inland = Math.min(1, (t - landThresh) / 0.7);
        const patch = Math.max(0, fbm(((lon + 180) / 360) * 6, ((90 - lat) / 180) * 6, 3, 2, 0.5, 123));
        const greenMix = clamp(Math.floor((patch - 0.35) * 3 * 255), 0, 255) / 255;

        const r = mix(sand[0], midland[0], inland);
        const g = mix(sand[1], midland[1], inland);
        const b = mix(sand[2], midland[2], inland);

        const finalR = mix(r, moss[0], greenMix * inland);
        const finalG = mix(g, moss[1], greenMix * inland);
        const finalB = mix(b, moss[2], greenMix * inland);

        img.data[px] = clamp(Math.floor(finalR));
        img.data[px + 1] = clamp(Math.floor(finalG));
        img.data[px + 2] = clamp(Math.floor(finalB));
        img.data[px + 3] = 255;
      } else {
        const prox = smoothstep(-0.05, landThresh, t);
        const r = mix(oceanDeep[0], oceanNear[0], prox);
        const g = mix(oceanDeep[1], oceanNear[1], prox);
        const b = mix(oceanDeep[2], oceanNear[2], prox);
        const grain = fbm(((lon + 180) / 360) * 40, ((90 - lat) / 180) * 40, 2, 2, 0.5, 999) * 0.15;
        img.data[px] = clamp(Math.floor(r + grain * 40));
        img.data[px + 1] = clamp(Math.floor(g + grain * 40));
        img.data[px + 2] = clamp(Math.floor(b + grain * 30));
        img.data[px + 3] = 255;
      }
    }
  }

  ctx.putImageData(img, 0, 0);

  const cloudCanvas = document.createElement('canvas');
  cloudCanvas.width = w;
  cloudCanvas.height = h;
  const cloudCtx = cloudCanvas.getContext('2d')!;
  cloudCtx.clearRect(0, 0, w, h);
  cloudCtx.globalAlpha = 0.75;

  for (let i = 0; i < 40; i++) {
    const cx = Math.random() * w;
    const cy = Math.random() * h;
    const size = 120 + Math.random() * 300;
    const grad = cloudCtx.createRadialGradient(cx, cy, 0, cx, cy, size);
    grad.addColorStop(0, 'rgba(255,255,255,0.95)');
    grad.addColorStop(0.6, 'rgba(255,255,255,0.75)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    cloudCtx.fillStyle = grad;
    cloudCtx.beginPath();
    cloudCtx.ellipse(cx, cy, size, size * 0.45, Math.random() * Math.PI, 0, Math.PI * 2);
    cloudCtx.fill();
  }

  ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(cloudCanvas, 0, 0);
  ctx.globalCompositeOperation = 'source-over';

  const rim = ctx.createRadialGradient(w * 0.3, h * 0.5, 0, w * 0.3, h * 0.5, w * 0.9);
  rim.addColorStop(0, 'rgba(255, 255, 220, 0.06)');
  rim.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = rim;
  ctx.fillRect(0, 0, w, h);

  return canvas.toDataURL('image/jpeg', 0.92);
}
