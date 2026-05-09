"""
Find optimal placement for each story location on the custom world map.
"""
import json
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
is_cloud = brightness > 195

def px_to_latlon(px_x, px_y):
    lon = (px_x / w) * 360 - 180
    lat = 90 - (px_y / h) * 180
    return round(lat, 1), round(lon, 1)

def latlon_to_px(lat, lon):
    px_x = int(((lon + 180) / 360) * w)
    px_y = int(((90 - lat) / 180) * h)
    return min(max(px_x, 0), w-1), min(max(px_y, 0), h-1)

def is_land_at(lat, lon, radius=5):
    """Check if a coordinate is on land (with some tolerance radius)."""
    cx, cy = latlon_to_px(lat, lon)
    count = 0
    total = 0
    for dy in range(-radius, radius+1, 2):
        for dx in range(-radius, radius+1, 2):
            ny, nx = cy + dy, cx + dx
            if 0 <= ny < h and 0 <= nx < w:
                total += 1
                if is_land[ny, nx]:
                    count += 1
    return count / max(total, 1)

def get_terrain_score(lat, lon, radius=15):
    """Get color characteristics of a land area."""
    cx, cy = latlon_to_px(lat, lon)
    rs, gs, bs = [], [], []
    for dy in range(-radius, radius+1, 3):
        for dx in range(-radius, radius+1, 3):
            ny, nx = cy + dy, cx + dx
            if 0 <= ny < h and 0 <= nx < w and is_land[ny, nx]:
                rs.append(pixels[ny, nx, 0])
                gs.append(pixels[ny, nx, 1])
                bs.append(pixels[ny, nx, 2])
    if not rs:
        return None
    return {
        'r': np.mean(rs), 'g': np.mean(gs), 'b': np.mean(bs),
        'brightness': (np.mean(rs) + np.mean(gs) + np.mean(bs)) / 3,
        'land_count': len(rs)
    }

def distance_deg(lat1, lon1, lat2, lon2):
    """Approximate distance in degrees."""
    return math.sqrt((lat1-lat2)**2 + (lon1-lon2)**2)

def find_best_position(target_check, existing_positions, min_distance=18):
    """Find best position that passes the target check and is far enough from existing ones."""
    best = None
    best_score = -1
    
    for y in range(10, h-10, 6):
        for x in range(10, w-10, 6):
            lat, lon = px_to_latlon(x, y)
            
            # Check minimum distance from existing positions
            too_close = False
            for elat, elon in existing_positions:
                if distance_deg(lat, lon, elat, elon) < min_distance:
                    too_close = True
                    break
            if too_close:
                continue
            
            score = target_check(lat, lon)
            if score is not None and score > best_score:
                best_score = score
                best = (lat, lon, score)
    
    return best


# STORY LOCATIONS TO PLACE:
# 1. Brenches - sounds like branches/trees, forested area
# 2. A vision - mystical/spiritual, could be near the cyclone or unique feature
# 3. Desert - arid, sandy terrain
# 4. Peaks - mountains, elevated terrain
# 5. Riva - shore/coast (Italian: "riva" = shore/bank)
# 6. Shrine - sacred place, could be isolated or on a small island
# 7. Swamp - dark, wet lowland area
# 8. Fumes - volcanic or industrial, dark/smoky area
# 9. Underwater - must be in deep water
# 10. What once was - ruins, could be remote or isolated island

placed = []

def check_forest(lat, lon):
    """Strongly green, on land, moderate-dark brightness = forest."""
    land_pct = is_land_at(lat, lon, 8)
    if land_pct < 0.5:
        return None
    t = get_terrain_score(lat, lon, 12)
    if not t:
        return None
    greenness = t['g'] - (t['r'] + t['b']) / 2
    if t['brightness'] > 170 or t['brightness'] < 100:
        return None
    return greenness * land_pct + (t['g'] - t['b']) * 0.5

# 1. BRENCHES (forest/branches) — find the greenest land area
result = find_best_position(check_forest, placed, min_distance=15)
if result:
    placed.append((result[0], result[1]))
    print(f"1. Brenches (forest): lat={result[0]}, lon={result[1]}, score={result[2]:.1f}")

# 3. DESERT — warmer tones, higher red relative to green, lighter
def check_desert(lat, lon):
    land_pct = is_land_at(lat, lon, 8)
    if land_pct < 0.4:
        return None
    t = get_terrain_score(lat, lon, 12)
    if not t:
        return None
    warmth = t['r'] - t['b']
    if warmth < -5:
        return None
    if t['brightness'] < 130:
        return None
    return warmth * land_pct + t['brightness'] * 0.1

result = find_best_position(check_desert, placed, min_distance=18)
if result:
    placed.append((result[0], result[1]))
    print(f"3. Desert: lat={result[0]}, lon={result[1]}, score={result[2]:.1f}")

# 4. PEAKS (mountains) — gray-ish tones, low saturation, on land, preferably higher latitude
def check_peaks(lat, lon):
    land_pct = is_land_at(lat, lon, 8)
    if land_pct < 0.4:
        return None
    t = get_terrain_score(lat, lon, 12)
    if not t:
        return None
    saturation = max(t['r'], t['g'], t['b']) - min(t['r'], t['g'], t['b'])
    if saturation > 30:
        return None
    if t['brightness'] < 110 or t['brightness'] > 175:
        return None
    return (30 - saturation) * land_pct + t['brightness'] * 0.05

result = find_best_position(check_peaks, placed, min_distance=18)
if result:
    placed.append((result[0], result[1]))
    print(f"4. Peaks (mountains): lat={result[0]}, lon={result[1]}, score={result[2]:.1f}")

# 5. RIVA (shore/coast) — on land but close to water
def check_coast(lat, lon):
    land_pct = is_land_at(lat, lon, 5)
    if land_pct < 0.3:
        return None
    # Check that water is nearby
    water_nearby = 0
    cx, cy = latlon_to_px(lat, lon)
    for dy in range(-20, 21, 4):
        for dx in range(-20, 21, 4):
            ny, nx = cy + dy, cx + dx
            if 0 <= ny < h and 0 <= nx < w and not is_land[ny, nx] and not is_cloud[ny, nx]:
                water_nearby += 1
    if water_nearby < 8:
        return None
    return water_nearby * land_pct

result = find_best_position(check_coast, placed, min_distance=18)
if result:
    placed.append((result[0], result[1]))
    print(f"5. Riva (coast/shore): lat={result[0]}, lon={result[1]}, score={result[2]:.1f}")

# 7. SWAMP — darkest green land areas, low brightness
def check_swamp(lat, lon):
    land_pct = is_land_at(lat, lon, 8)
    if land_pct < 0.4:
        return None
    t = get_terrain_score(lat, lon, 12)
    if not t:
        return None
    if t['brightness'] > 140:
        return None
    darkness = 140 - t['brightness']
    greenness = t['g'] - t['b']
    if greenness < 0:
        return None
    return darkness * land_pct + greenness * 0.3

result = find_best_position(check_swamp, placed, min_distance=18)
if result:
    placed.append((result[0], result[1]))
    print(f"7. Swamp: lat={result[0]}, lon={result[1]}, score={result[2]:.1f}")

# 8. FUMES (volcanic) — dark, warm-toned, on land
def check_fumes(lat, lon):
    land_pct = is_land_at(lat, lon, 8)
    if land_pct < 0.35:
        return None
    t = get_terrain_score(lat, lon, 12)
    if not t:
        return None
    warmth = t['r'] - t['b']
    if t['brightness'] > 160:
        return None
    return warmth * land_pct + (150 - t['brightness']) * 0.3

result = find_best_position(check_fumes, placed, min_distance=18)
if result:
    placed.append((result[0], result[1]))
    print(f"8. Fumes (volcanic): lat={result[0]}, lon={result[1]}, score={result[2]:.1f}")

# 6. SHRINE — isolated, could be on a small island or distinct land area
def check_shrine(lat, lon):
    land_pct = is_land_at(lat, lon, 6)
    if land_pct < 0.25:
        return None
    # Prefer smaller/isolated land masses
    water_surround = 0
    cx, cy = latlon_to_px(lat, lon)
    for dy in range(-30, 31, 5):
        for dx in range(-30, 31, 5):
            ny, nx = cy + dy, cx + dx
            if 0 <= ny < h and 0 <= nx < w and not is_land[ny, nx]:
                water_surround += 1
    isolation = water_surround / 144  # higher = more isolated
    return isolation * land_pct * 100

result = find_best_position(check_shrine, placed, min_distance=18)
if result:
    placed.append((result[0], result[1]))
    print(f"6. Shrine (isolated): lat={result[0]}, lon={result[1]}, score={result[2]:.1f}")

# 2. A VISION — near the cyclone/spiral, which is a unique mystical feature
def check_vision(lat, lon):
    land_pct = is_land_at(lat, lon, 6)
    if land_pct < 0.25:
        return None
    # Should be near the cyclone center (~0, -19)
    cyclone_lat, cyclone_lon = 0, -19
    dist = distance_deg(lat, lon, cyclone_lat, cyclone_lon)
    if dist > 35:
        return None
    # Check for nearby bright/cloud features (cyclone)
    cx, cy = latlon_to_px(lat, lon)
    bright_nearby = 0
    for dy in range(-25, 26, 4):
        for dx in range(-25, 26, 4):
            ny, nx = cy + dy, cx + dx
            if 0 <= ny < h and 0 <= nx < w and brightness[ny, nx] > 180:
                bright_nearby += 1
    proximity = max(0, 35 - dist)
    return proximity * land_pct + bright_nearby * 0.5

result = find_best_position(check_vision, placed, min_distance=15)
if result:
    placed.append((result[0], result[1]))
    print(f"2. A vision (mystical/cyclone): lat={result[0]}, lon={result[1]}, score={result[2]:.1f}")

# 9. UNDERWATER — must be in water, away from land
def check_underwater(lat, lon):
    land_pct = is_land_at(lat, lon, 10)
    if land_pct > 0.05:
        return None
    cx, cy = latlon_to_px(lat, lon)
    if 0 <= cy < h and 0 <= cx < w:
        pb = float(pixels[cy, cx, 2])
        br = float(brightness[cy, cx])
        if br > 160:  # avoid clouds
            return None
        # Prefer deeper blue water
        blueness = pb - br * 0.5
        # Prefer being not too far from land (for visual interest)
        nearest_land = 999
        for dy in range(-60, 61, 8):
            for dx in range(-60, 61, 8):
                ny, nx = cy + dy, cx + dx
                if 0 <= ny < h and 0 <= nx < w and is_land[ny, nx]:
                    d = math.sqrt(dy*dy + dx*dx)
                    nearest_land = min(nearest_land, d)
        if nearest_land > 200:
            return None
        # Sweet spot: close enough to see from land, but clearly in water
        proximity_bonus = max(0, 60 - nearest_land) * 0.3
        return blueness + proximity_bonus
    return None

result = find_best_position(check_underwater, placed, min_distance=15)
if result:
    placed.append((result[0], result[1]))
    print(f"9. Underwater: lat={result[0]}, lon={result[1]}, score={result[2]:.1f}")

# 10. WHAT ONCE WAS (ruins) — remote, possibly on a smaller isolated landmass
def check_ruins(lat, lon):
    land_pct = is_land_at(lat, lon, 6)
    if land_pct < 0.2:
        return None
    t = get_terrain_score(lat, lon, 10)
    if not t:
        return None
    # Prefer more remote/southern locations
    remoteness = abs(lat) * 0.3
    return land_pct * 50 + remoteness

result = find_best_position(check_ruins, placed, min_distance=18)
if result:
    placed.append((result[0], result[1]))
    print(f"10. What once was (ruins): lat={result[0]}, lon={result[1]}, score={result[2]:.1f}")

# Summary
print("\n\n=== FINAL LOCATION ASSIGNMENTS ===")
print("(Copy these into stories.json)")

stories = [
    ("story-01", "Brenches"),
    ("story-02", "A vision"),
    ("story-03", "Desert"),
    ("story-04", "Peaks"),
    ("story-05", "Riva"),
    ("story-06", "Shrine"),
    ("story-07", "Swamp"),
    ("story-08", "Fumes"),
    ("story-09", "Underwater"),
    ("story-10", "What once was"),
]

# Map our findings to story order
assignments = {}
for lat, lon in placed:
    # Already printed above with labels
    pass

print("\nVerification - is each location on correct terrain?")
for lat, lon in placed:
    land_pct = is_land_at(lat, lon, 5) * 100
    t = get_terrain_score(lat, lon, 10)
    if t:
        print(f"  ({lat:6.1f}, {lon:7.1f}): land={land_pct:.0f}%, "
              f"R={t['r']:.0f} G={t['g']:.0f} B={t['b']:.0f}, brightness={t['brightness']:.0f}")
    else:
        print(f"  ({lat:6.1f}, {lon:7.1f}): land={land_pct:.0f}% (in water)")
