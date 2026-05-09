"""
Find optimal placement for each story location on the custom world map.
Based purely on image pixel analysis of the equirectangular texture.
"""
import math
from PIL import Image
import numpy as np

IMG_PATH = "/workspace/public/assets/images/world-equirectangular.png"

img = Image.open(IMG_PATH).convert("RGB")
w, h = img.size
pixels = np.array(img)

r, g, b = pixels[:,:,0].astype(float), pixels[:,:,1].astype(float), pixels[:,:,2].astype(float)
brightness = (r + g + b) / 3
blue_dominance = b - (r + g) / 2
green_rel = g - (r * 0.3 + b * 0.7)

is_land = (green_rel > -10) & (blue_dominance < 20) & (brightness < 200) & (brightness > 60)

def px_to_latlon(px_x, px_y):
    lon = (px_x / w) * 360 - 180
    lat = 90 - (px_y / h) * 180
    return round(lat, 1), round(lon, 1)

def latlon_to_px(lat, lon):
    px_x = int(((lon + 180) / 360) * w)
    px_y = int(((90 - lat) / 180) * h)
    return min(max(px_x, 0), w-1), min(max(px_y, 0), h-1)

def land_fraction(lat, lon, radius=8):
    cx, cy = latlon_to_px(lat, lon)
    count = total = 0
    for dy in range(-radius, radius+1, 2):
        for dx in range(-radius, radius+1, 2):
            ny, nx = cy + dy, cx + dx
            if 0 <= ny < h and 0 <= nx < w:
                total += 1
                if is_land[ny, nx]:
                    count += 1
    return count / max(total, 1)

def avg_color(lat, lon, radius=12):
    cx, cy = latlon_to_px(lat, lon)
    rs, gs, bs = [], [], []
    for dy in range(-radius, radius+1, 2):
        for dx in range(-radius, radius+1, 2):
            ny, nx = cy + dy, cx + dx
            if 0 <= ny < h and 0 <= nx < w and is_land[ny, nx]:
                rs.append(float(pixels[ny, nx, 0]))
                gs.append(float(pixels[ny, nx, 1]))
                bs.append(float(pixels[ny, nx, 2]))
    if not rs:
        return None
    return np.mean(rs), np.mean(gs), np.mean(bs)

def dist(lat1, lon1, lat2, lon2):
    return math.sqrt((lat1 - lat2)**2 + (lon1 - lon2)**2)

def far_enough(lat, lon, placed, min_d=18):
    return all(dist(lat, lon, pl, pn) >= min_d for pl, pn in placed)

def scan_best(scorer, placed, min_d=18, step=5):
    best = None
    best_score = -999
    for y in range(8, h-8, step):
        for x in range(8, w-8, step):
            lat, lon = px_to_latlon(x, y)
            if not far_enough(lat, lon, placed, min_d):
                continue
            s = scorer(lat, lon)
            if s is not None and s > best_score:
                best_score = s
                best = (lat, lon)
    return best, best_score

placed = []

# ------------------------------------------------------------------
# 1. BRENCHES (forest) — greenest land
# ------------------------------------------------------------------
def score_forest(lat, lon):
    lf = land_fraction(lat, lon, 8)
    if lf < 0.5: return None
    c = avg_color(lat, lon, 14)
    if not c: return None
    ar, ag, ab = c
    br = (ar + ag + ab) / 3
    if br > 170 or br < 100: return None
    return (ag - (ar + ab) / 2) * lf

pos, sc = scan_best(score_forest, placed)
if pos:
    placed.append(pos)
    print(f"01 Brenches (forest)       : {pos[0]:7.1f}, {pos[1]:7.1f}  score={sc:.1f}")

# ------------------------------------------------------------------
# 3. DESERT — warmest / lightest land tones
# ------------------------------------------------------------------
def score_desert(lat, lon):
    lf = land_fraction(lat, lon, 8)
    if lf < 0.4: return None
    c = avg_color(lat, lon, 14)
    if not c: return None
    ar, ag, ab = c
    br = (ar + ag + ab) / 3
    if br < 145: return None
    warmth = ar - ab
    return warmth * lf + br * 0.15

pos, sc = scan_best(score_desert, placed)
if pos:
    placed.append(pos)
    print(f"03 Desert                  : {pos[0]:7.1f}, {pos[1]:7.1f}  score={sc:.1f}")

# ------------------------------------------------------------------
# 4. PEAKS — low saturation (grayish), moderate brightness
# ------------------------------------------------------------------
def score_peaks(lat, lon):
    lf = land_fraction(lat, lon, 8)
    if lf < 0.4: return None
    c = avg_color(lat, lon, 14)
    if not c: return None
    ar, ag, ab = c
    br = (ar + ag + ab) / 3
    sat = max(ar, ag, ab) - min(ar, ag, ab)
    if sat > 25 or br < 120 or br > 175: return None
    return (25 - sat) * lf + br * 0.08

pos, sc = scan_best(score_peaks, placed)
if pos:
    placed.append(pos)
    print(f"04 Peaks (mountains)       : {pos[0]:7.1f}, {pos[1]:7.1f}  score={sc:.1f}")

# ------------------------------------------------------------------
# 5. RIVA (shore) — land with nearby water
# ------------------------------------------------------------------
def score_coast(lat, lon):
    lf = land_fraction(lat, lon, 5)
    if lf < 0.3: return None
    cx, cy = latlon_to_px(lat, lon)
    water = 0
    for dy in range(-22, 23, 4):
        for dx in range(-22, 23, 4):
            ny, nx = cy + dy, cx + dx
            if 0 <= ny < h and 0 <= nx < w and not is_land[ny, nx]:
                water += 1
    if water < 10: return None
    return water * lf

pos, sc = scan_best(score_coast, placed)
if pos:
    placed.append(pos)
    print(f"05 Riva (coast)            : {pos[0]:7.1f}, {pos[1]:7.1f}  score={sc:.1f}")

# ------------------------------------------------------------------
# 7. SWAMP — darkest green land
# ------------------------------------------------------------------
def score_swamp(lat, lon):
    lf = land_fraction(lat, lon, 8)
    if lf < 0.4: return None
    c = avg_color(lat, lon, 14)
    if not c: return None
    ar, ag, ab = c
    br = (ar + ag + ab) / 3
    if br > 145: return None
    greenness = ag - ab
    if greenness < 0: return None
    return (145 - br) * lf + greenness * 0.4

pos, sc = scan_best(score_swamp, placed)
if pos:
    placed.append(pos)
    print(f"07 Swamp                   : {pos[0]:7.1f}, {pos[1]:7.1f}  score={sc:.1f}")

# ------------------------------------------------------------------
# 8. FUMES (volcanic) — darker, warmer land
# ------------------------------------------------------------------
def score_fumes(lat, lon):
    lf = land_fraction(lat, lon, 8)
    if lf < 0.35: return None
    c = avg_color(lat, lon, 14)
    if not c: return None
    ar, ag, ab = c
    br = (ar + ag + ab) / 3
    if br > 155: return None
    warmth = ar - ab
    return warmth * lf + (155 - br) * 0.35

pos, sc = scan_best(score_fumes, placed)
if pos:
    placed.append(pos)
    print(f"08 Fumes (volcanic)        : {pos[0]:7.1f}, {pos[1]:7.1f}  score={sc:.1f}")

# ------------------------------------------------------------------
# 6. SHRINE — isolated small island
# ------------------------------------------------------------------
def score_shrine(lat, lon):
    lf = land_fraction(lat, lon, 5)
    if lf < 0.2: return None
    cx, cy = latlon_to_px(lat, lon)
    water = 0
    for dy in range(-35, 36, 5):
        for dx in range(-35, 36, 5):
            ny, nx = cy + dy, cx + dx
            if 0 <= ny < h and 0 <= nx < w and not is_land[ny, nx]:
                water += 1
    return (water / 196) * lf * 100

pos, sc = scan_best(score_shrine, placed, min_d=18)
if pos:
    placed.append(pos)
    print(f"06 Shrine (isolated)       : {pos[0]:7.1f}, {pos[1]:7.1f}  score={sc:.1f}")

# ------------------------------------------------------------------
# 2. A VISION — near the cyclone / spiral feature (center ~0, -19)
# ------------------------------------------------------------------
def score_vision(lat, lon):
    lf = land_fraction(lat, lon, 6)
    if lf < 0.25: return None
    d = dist(lat, lon, 0, -19)
    if d > 30: return None
    cx, cy = latlon_to_px(lat, lon)
    bright = 0
    for dy in range(-25, 26, 4):
        for dx in range(-25, 26, 4):
            ny, nx = cy + dy, cx + dx
            if 0 <= ny < h and 0 <= nx < w and brightness[ny, nx] > 180:
                bright += 1
    return (30 - d) * lf + bright * 0.5

pos, sc = scan_best(score_vision, placed, min_d=12)
if pos:
    placed.append(pos)
    print(f"02 A vision (cyclone)      : {pos[0]:7.1f}, {pos[1]:7.1f}  score={sc:.1f}")

# ------------------------------------------------------------------
# 9. UNDERWATER — in open water, near-ish to land
# ------------------------------------------------------------------
def score_underwater(lat, lon):
    lf = land_fraction(lat, lon, 10)
    if lf > 0.05: return None
    cx, cy = latlon_to_px(lat, lon)
    if not (0 <= cy < h and 0 <= cx < w): return None
    br = float(brightness[cy, cx])
    if br > 155: return None  # skip clouds
    pb = float(pixels[cy, cx, 2])
    near = 999
    for dy in range(-50, 51, 6):
        for dx in range(-50, 51, 6):
            ny, nx = cy + dy, cx + dx
            if 0 <= ny < h and 0 <= nx < w and is_land[ny, nx]:
                near = min(near, math.sqrt(dy*dy + dx*dx))
    if near > 150: return None
    return (pb - br * 0.5) + max(0, 50 - near) * 0.4

pos, sc = scan_best(score_underwater, placed, min_d=15)
if pos:
    placed.append(pos)
    print(f"09 Underwater              : {pos[0]:7.1f}, {pos[1]:7.1f}  score={sc:.1f}")

# ------------------------------------------------------------------
# 10. WHAT ONCE WAS (ruins) — remote land, far from everything
# ------------------------------------------------------------------
def score_ruins(lat, lon):
    lf = land_fraction(lat, lon, 5)
    if lf < 0.2: return None
    remoteness = abs(lat) * 0.5
    return lf * 40 + remoteness

pos, sc = scan_best(score_ruins, placed, min_d=18)
if pos:
    placed.append(pos)
    print(f"10 What once was (ruins)   : {pos[0]:7.1f}, {pos[1]:7.1f}  score={sc:.1f}")

print(f"\nPlaced {len(placed)} / 10 locations")
print("\nAll coordinates:")
for i, (lat, lon) in enumerate(placed):
    lf = land_fraction(lat, lon, 5) * 100
    c = avg_color(lat, lon, 10)
    if c:
        print(f"  {lat:7.1f}, {lon:7.1f}  land={lf:.0f}%  color=({c[0]:.0f},{c[1]:.0f},{c[2]:.0f})")
    else:
        print(f"  {lat:7.1f}, {lon:7.1f}  land={lf:.0f}%  (water)")
