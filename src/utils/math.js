export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function clamp(v, min, max) {
  return Math.min(Math.max(v, min), max);
}

export function round(v, d) {
  const f = 10 ** d;
  return Math.round(v * f) / f;
}

export function degreesToRadians(d) {
  return (d * Math.PI) / 180;
}

export function radiansToDegrees(r) {
  return (r * 180) / Math.PI;
}
