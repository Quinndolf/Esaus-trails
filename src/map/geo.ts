const R = 6371008.8; // mean earth radius, meters
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

export type LngLat = [number, number];

/** Point reached by travelling `meters` from `origin` on `bearing` (degrees from true north). */
export function destination([lng, lat]: LngLat, bearing: number, meters: number): LngLat {
  const d = meters / R;
  const b = toRad(bearing);
  const p1 = toRad(lat);
  const l1 = toRad(lng);
  const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(b));
  const l2 = l1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
  return [((toDeg(l2) + 540) % 360) - 180, toDeg(p2)];
}

/** Closed ring approximating a circle, for the GPS accuracy halo. */
export function circleRing(center: LngLat, meters: number, steps = 48): LngLat[] {
  const ring: LngLat[] = [];
  for (let i = 0; i <= steps; i++) ring.push(destination(center, (i / steps) * 360, meters));
  return ring;
}

/** Closed ring for a sight cone: a wedge `spread` degrees wide, `meters` long, facing `bearing`. */
export function coneRing(center: LngLat, bearing: number, spread: number, meters: number, steps = 16): LngLat[] {
  const ring: LngLat[] = [center];
  const start = bearing - spread / 2;
  for (let i = 0; i <= steps; i++) ring.push(destination(center, start + (i / steps) * spread, meters));
  ring.push(center);
  return ring;
}

export function normalizeBearing(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

const POINTS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

export function cardinal(deg: number): string {
  return POINTS[Math.round(normalizeBearing(deg) / 22.5) % 16];
}

/** Shortest signed angle from a to b, in degrees (-180, 180]. */
export function angleDelta(a: number, b: number): number {
  let d = normalizeBearing(b) - normalizeBearing(a);
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

export function metersToFeet(m: number): number {
  return m * 3.28084;
}
