// Deterministic 2D value noise + terrain helpers
// Simple, fast implementation to generate continent shapes and test whether a lat/lon is land.

function fract(x: number) {
  return x - Math.floor(x);
}

function fade(t: number) {
  // Smoothstep-like easing
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function hash2(x: number, y: number, seed = 0) {
  // Deterministic pseudo-random based on sin/hash trick
  const s = Math.sin(x * 127.1 + y * 311.7 + seed * 78.233) * 43758.5453123;
  return fract(s);
}

function valueNoise2D(x: number, y: number, seed = 0) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;

  const v00 = hash2(xi, yi, seed);
  const v10 = hash2(xi + 1, yi, seed);
  const v01 = hash2(xi, yi + 1, seed);
  const v11 = hash2(xi + 1, yi + 1, seed);

  const u = fade(xf);
  const v = fade(yf);

  const a = lerp(v00, v10, u);
  const b = lerp(v01, v11, u);
  return lerp(a, b, v) * 2 - 1; // map to [-1,1]
}

export function fbm(x: number, y: number, octaves = 4, lacunarity = 2, gain = 0.5, seed = 0) {
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let max = 0;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise2D(x * freq, y * freq, seed + i * 10) * amp;
    max += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / max; // approx in [-1,1]
}

// Map lat/lon to normalized coords [0,1]
function lonLatToUV(lat: number, lon: number) {
  const u = (lon + 180) / 360;
  const v = (90 - lat) / 180;
  return { u, v };
}

// Terrain evaluation. Returns value approx in [-1,1] where higher means higher ground.
export function terrainValue(lat: number, lon: number) {
  const { u, v } = lonLatToUV(lat, lon);

  // Coordinates for noise sampling - wrap longitude by repeating pattern
  const nx = u * 2; // scale controls continent size
  const ny = v * 1;

  // Base continents
  const base = fbm(nx * 1.5, ny * 1.5, 5, 2, 0.5, 42);
  // Larger-scale variation for big ocean basins
  const large = fbm(nx * 0.5, ny * 0.5, 3, 2, 0.6, 7) * 0.6;
  // Finer detail for shores
  const detail = fbm(nx * 6, ny * 6, 3, 2, 0.5, 99) * 0.25;

  const value = base * 0.9 + large * 0.5 + detail * 0.6;
  return value; // roughly in [-1,1]
}

export function isLand(lat: number, lon: number, threshold = 0.05) {
  return terrainValue(lat, lon) > threshold;
}

export function findNearestLand(lat: number, lon: number, maxRadiusDeg = 12, stepDeg = 0.5, threshold = 0.05) {
  if (isLand(lat, lon, threshold)) return { latitude: lat, longitude: lon };

  const maxSteps = Math.ceil(maxRadiusDeg / stepDeg);
  for (let r = 1; r <= maxSteps; r++) {
    // sample around circle
    const radius = r * stepDeg;
    const samples = Math.max(8, Math.floor(6 * r));
    for (let i = 0; i < samples; i++) {
      const angle = (i / samples) * Math.PI * 2;
      const candLat = lat + Math.cos(angle) * radius;
      const candLon = lon + Math.sin(angle) * radius;
      // clamp latitude to -90..90
      const clampedLat = Math.max(-89.9, Math.min(89.9, candLat));
      const wrappedLon = ((candLon + 180 + 540) % 360) - 180; // wrap to -180..180
      if (isLand(clampedLat, wrappedLon, threshold)) {
        return { latitude: clampedLat, longitude: wrappedLon };
      }
    }
  }

  // fallback: return original
  return { latitude: lat, longitude: lon };
}
