"""
Analyze the equirectangular world texture to find land masses,
classify terrain types by color, and propose optimal story locations.
"""
import json
from PIL import Image
import numpy as np

IMG_PATH = "/workspace/public/assets/images/world-equirectangular.png"

img = Image.open(IMG_PATH).convert("RGB")
w, h = img.size
pixels = np.array(img)

print(f"Image dimensions: {w}x{h}")
print(f"Aspect ratio: {w/h:.2f} (should be ~2.0 for equirectangular)")

# In equirectangular projection:
# x=0 => lon=-180, x=w => lon=+180
# y=0 => lat=+90 (north pole), y=h => lat=-90 (south pole)

def px_to_latlon(px_x, px_y):
    lon = (px_x / w) * 360 - 180
    lat = 90 - (px_y / h) * 180
    return lat, lon

def latlon_to_px(lat, lon):
    px_x = int(((lon + 180) / 360) * w)
    px_y = int(((90 - lat) / 180) * h)
    return px_x, px_y

# Classify each pixel as land, water, or cloud based on color
r, g, b = pixels[:,:,0], pixels[:,:,1], pixels[:,:,2]

# Water is predominantly blue (high blue, lower red/green)
# Land is greenish/olive (similar red and green, lower blue)
# Clouds are white-ish (high all channels)

# Compute a "blueness" metric: how much bluer than green
blue_dominance = b.astype(float) - (r.astype(float) + g.astype(float)) / 2
brightness = (r.astype(float) + g.astype(float) + b.astype(float)) / 3

# Land detection: greenish tones, not too bright (not clouds), not too blue
# Land pixels have: green relatively high, blue not dominant, moderate brightness
green_rel = g.astype(float) - (r.astype(float) * 0.3 + b.astype(float) * 0.7)
is_land = (green_rel > -10) & (blue_dominance < 20) & (brightness < 200) & (brightness > 60)

# Cloud detection: very bright, low color saturation
is_cloud = brightness > 195

# Water: everything else
is_water = ~is_land & ~is_cloud

# Print overall stats
total = w * h
land_pct = np.sum(is_land) / total * 100
water_pct = np.sum(is_water) / total * 100
cloud_pct = np.sum(is_cloud) / total * 100
print(f"\nTerrain breakdown:")
print(f"  Land:  {land_pct:.1f}%")
print(f"  Water: {water_pct:.1f}%")
print(f"  Cloud: {cloud_pct:.1f}%")

# Find land regions by scanning in a grid and finding large contiguous land areas
# Sample grid to find land center-of-mass regions
grid_step = 10
land_points = []
for y in range(0, h, grid_step):
    for x in range(0, w, grid_step):
        if is_land[y, x]:
            lat, lon = px_to_latlon(x, y)
            land_points.append((lat, lon, x, y))

print(f"\nTotal land sample points: {len(land_points)}")

# Use a simple clustering approach: find distinct land regions
# by flood-filling on a downsampled version
scale = 4
small_land = is_land[::scale, ::scale]
sh, sw = small_land.shape
visited = np.zeros_like(small_land, dtype=bool)
regions = []

def flood_fill(sy, sx):
    stack = [(sy, sx)]
    points = []
    while stack:
        cy, cx = stack.pop()
        if cy < 0 or cy >= sh or cx < 0 or cx >= sw:
            continue
        if visited[cy, cx] or not small_land[cy, cx]:
            continue
        visited[cy, cx] = True
        points.append((cy, cx))
        stack.extend([(cy-1,cx),(cy+1,cx),(cy,cx-1),(cy,cx+1)])
    return points

for y in range(sh):
    for x in range(sw):
        if small_land[y, x] and not visited[y, x]:
            pts = flood_fill(y, x)
            if len(pts) > 20:  # filter tiny noise
                ys = [p[0] for p in pts]
                xs = [p[1] for p in pts]
                cy = int(np.mean(ys)) * scale
                cx = int(np.mean(xs)) * scale
                area = len(pts) * scale * scale
                lat, lon = px_to_latlon(cx, cy)
                regions.append({
                    'center_lat': round(lat, 1),
                    'center_lon': round(lon, 1),
                    'area_px': area,
                    'num_points': len(pts),
                    'min_y': min(ys) * scale,
                    'max_y': max(ys) * scale,
                    'min_x': min(xs) * scale,
                    'max_x': max(xs) * scale,
                })

# Sort by area (largest first)
regions.sort(key=lambda r: r['area_px'], reverse=True)

print(f"\nFound {len(regions)} distinct land regions:")
for i, reg in enumerate(regions):
    lat_range = f"{px_to_latlon(0, reg['max_y'])[0]:.0f} to {px_to_latlon(0, reg['min_y'])[0]:.0f}"
    lon_range = f"{px_to_latlon(reg['min_x'], 0)[1]:.0f} to {px_to_latlon(reg['max_x'], 0)[1]:.0f}"
    print(f"  Region {i+1}: center=({reg['center_lat']}, {reg['center_lon']}), "
          f"area={reg['area_px']}px, lat={lat_range}, lon={lon_range}")

# Now let's analyze the color/terrain type within each region
# to identify: desert areas (warm/sandy tones), green areas (forests),
# dark areas (swamps), mountainous areas (gray/brown tones), etc.
print("\n\nDetailed color analysis per region:")
for i, reg in enumerate(regions[:10]):
    y1, y2 = reg['min_y'], reg['max_y']
    x1, x2 = reg['min_x'], reg['max_x']
    region_pixels = pixels[y1:y2+1, x1:x2+1]
    region_land = is_land[y1:y2+1, x1:x2+1]
    
    if np.sum(region_land) == 0:
        continue
    
    land_r = region_pixels[:,:,0][region_land].astype(float)
    land_g = region_pixels[:,:,1][region_land].astype(float)
    land_b = region_pixels[:,:,2][region_land].astype(float)
    
    avg_r = np.mean(land_r)
    avg_g = np.mean(land_g)
    avg_b = np.mean(land_b)
    avg_brightness = (avg_r + avg_g + avg_b) / 3
    
    print(f"\n  Region {i+1} (center: {reg['center_lat']}, {reg['center_lon']}):")
    print(f"    Avg color: R={avg_r:.0f} G={avg_g:.0f} B={avg_b:.0f}, brightness={avg_brightness:.0f}")
    
    # Sub-analyze: find the darkest, greenest, driest parts within the region
    # Divide the region into quadrants
    mid_y = (y1 + y2) // 2
    mid_x = (x1 + x2) // 2
    
    quadrants = [
        ("NW", y1, mid_y, x1, mid_x),
        ("NE", y1, mid_y, mid_x, x2),
        ("SW", mid_y, y2, x1, mid_x),
        ("SE", mid_y, y2, mid_x, x2),
    ]
    
    for name, qy1, qy2, qx1, qx2 in quadrants:
        qpixels = pixels[qy1:qy2+1, qx1:qx2+1]
        qland = is_land[qy1:qy2+1, qx1:qx2+1]
        if np.sum(qland) < 10:
            continue
        qr = np.mean(qpixels[:,:,0][qland].astype(float))
        qg = np.mean(qpixels[:,:,1][qland].astype(float))
        qb = np.mean(qpixels[:,:,2][qland].astype(float))
        center_y = (qy1 + qy2) // 2
        center_x = (qx1 + qx2) // 2
        qlat, qlon = px_to_latlon(center_x, center_y)
        print(f"    {name}: R={qr:.0f} G={qg:.0f} B={qb:.0f} => center ({qlat:.1f}, {qlon:.1f})")

# Now let's find specific terrain features by scanning the land for color patterns
print("\n\n=== TERRAIN FEATURE SEARCH ===")
print("Looking for specific terrain types within land areas...")

# Sample land pixels in a grid and classify by color
terrain_map = {}
sample_step = 8
for y in range(0, h, sample_step):
    for x in range(0, w, sample_step):
        if not is_land[y, x]:
            continue
        pr, pg, pb = int(pixels[y, x, 0]), int(pixels[y, x, 1]), int(pixels[y, x, 2])
        brightness_val = (pr + pg + pb) / 3
        
        lat, lon = px_to_latlon(x, y)
        
        # Desert: warmer/sandy tones - higher red relative to green, moderate brightness
        if pr > pg and pr > 130 and brightness_val > 100 and brightness_val < 180:
            terrain_map.setdefault('desert', []).append((lat, lon, pr, pg, pb))
        
        # Dark/swampy: very dark green, low brightness
        elif brightness_val < 90 and pg > pb:
            terrain_map.setdefault('swamp', []).append((lat, lon, pr, pg, pb))
        
        # Peaks/mountains: gray-ish, medium brightness, low saturation
        elif abs(pr - pg) < 15 and abs(pg - pb) < 15 and brightness_val > 100 and brightness_val < 160:
            terrain_map.setdefault('peaks', []).append((lat, lon, pr, pg, pb))
        
        # Lush green: strong green
        elif pg > pr and pg > pb and pg > 120:
            terrain_map.setdefault('green', []).append((lat, lon, pr, pg, pb))
        
        # Coast/shore: between land and water colors
        elif brightness_val > 120 and pb > 100 and pg > 100:
            terrain_map.setdefault('coast', []).append((lat, lon, pr, pg, pb))

for terrain_type, points in terrain_map.items():
    lats = [p[0] for p in points]
    lons = [p[1] for p in points]
    avg_lat = np.mean(lats)
    avg_lon = np.mean(lons)
    print(f"\n{terrain_type.upper()} ({len(points)} samples):")
    print(f"  Average location: ({avg_lat:.1f}, {avg_lon:.1f})")
    print(f"  Lat range: {min(lats):.1f} to {max(lats):.1f}")
    print(f"  Lon range: {min(lons):.1f} to {max(lons):.1f}")
    # Find the densest cluster
    if len(points) > 5:
        # Simple: divide into 4x4 grid and find the cell with most points
        lat_bins = np.linspace(min(lats), max(lats), 5)
        lon_bins = np.linspace(min(lons), max(lons), 5)
        best_count = 0
        best_center = (avg_lat, avg_lon)
        for li in range(4):
            for lj in range(4):
                cell_pts = [(la, lo) for la, lo, *_ in points 
                           if lat_bins[li] <= la < lat_bins[li+1] and lon_bins[lj] <= lo < lon_bins[lj+1]]
                if len(cell_pts) > best_count:
                    best_count = len(cell_pts)
                    best_center = (np.mean([p[0] for p in cell_pts]), np.mean([p[1] for p in cell_pts]))
        print(f"  Densest cluster center: ({best_center[0]:.1f}, {best_center[1]:.1f}) ({best_count} pts)")

# Find water areas suitable for "underwater" story
print("\n\n=== DEEP WATER ANALYSIS ===")
water_points = []
for y in range(0, h, sample_step * 2):
    for x in range(0, w, sample_step * 2):
        if is_water[y, x] and not is_cloud[y, x]:
            pr, pg, pb = int(pixels[y, x, 0]), int(pixels[y, x, 1]), int(pixels[y, x, 2])
            brightness_val = (pr + pg + pb) / 3
            # Deep water: darkest blue
            if pb > 100 and brightness_val < 140:
                lat, lon = px_to_latlon(x, y)
                water_points.append((lat, lon, brightness_val))

if water_points:
    # Sort by brightness (darkest = deepest)
    water_points.sort(key=lambda p: p[2])
    deepest = water_points[:20]
    avg_lat = np.mean([p[0] for p in deepest])
    avg_lon = np.mean([p[1] for p in deepest])
    print(f"Deepest water areas (darkest blue):")
    print(f"  Average of 20 deepest: ({avg_lat:.1f}, {avg_lon:.1f})")
    for p in deepest[:5]:
        print(f"    ({p[0]:.1f}, {p[1]:.1f}) brightness={p[2]:.0f}")

# Check the cyclone/spiral feature in the center
print("\n\n=== CYCLONE/SPIRAL FEATURE ===")
# From visual inspection, the cyclone is roughly in the center of the main continent
# Let's find the brightest cluster within the central land area
center_bright = []
for y in range(h//4, 3*h//4, sample_step):
    for x in range(w//4, 3*w//4, sample_step):
        pr, pg, pb = int(pixels[y, x, 0]), int(pixels[y, x, 1]), int(pixels[y, x, 2])
        brightness_val = (pr + pg + pb) / 3
        if brightness_val > 180:  # Very bright = cloud/cyclone
            lat, lon = px_to_latlon(x, y)
            center_bright.append((lat, lon, brightness_val))

if center_bright:
    lats = [p[0] for p in center_bright]
    lons = [p[1] for p in center_bright]
    print(f"Bright central feature (likely cyclone):")
    print(f"  Center: ({np.mean(lats):.1f}, {np.mean(lons):.1f})")
    print(f"  Lat range: {min(lats):.1f} to {max(lats):.1f}")
    print(f"  Lon range: {min(lons):.1f} to {max(lons):.1f}")

print("\n\nDone!")
