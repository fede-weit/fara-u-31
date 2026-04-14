export function hexToRgba(hex: string | undefined, alpha: number): string {
  if (typeof hex !== 'string') {
    return `rgba(255, 255, 255, ${alpha})`;
  }

  let sanitized = hex.replace('#', '').trim();

  if (sanitized.length === 3) {
    sanitized = sanitized
      .split('')
      .map((ch) => ch + ch)
      .join('');
  }

  if (sanitized.length !== 6) {
    return `rgba(255, 255, 255, ${alpha})`;
  }

  const value = parseInt(sanitized, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

