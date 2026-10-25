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

/** Great-circle distance in meters. */
export function distance([lng1, lat1]: LngLat, [lng2, lat2]: LngLat): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function pathLength(points: LngLat[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += distance(points[i - 1], points[i]);
  return total;
}

/** Area of a closed ring in square meters (spherical excess approximation, fine at hunting-property scale). */
export function polygonArea(ring: LngLat[]): number {
  if (ring.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const [lng1, lat1] = ring[i];
    const [lng2, lat2] = ring[(i + 1) % ring.length];
    sum += toRad(lng2 - lng1) * (2 + Math.sin(toRad(lat1)) + Math.sin(toRad(lat2)));
  }
  return Math.abs((sum * R * R) / 2);
}

/** Hunter-friendly distance: yards up close, miles further out. */
export function formatDistance(meters: number): string {
  const yards = meters * 1.09361;
  if (yards < 1000) return `${Math.round(yards)} yd`;
  const miles = meters / 1609.344;
  return `${miles < 10 ? miles.toFixed(2) : miles.toFixed(1)} mi`;
}

export function formatArea(squareMeters: number): string {
  const acres = squareMeters / 4046.8564224;
  return `${acres < 10 ? acres.toFixed(1) : Math.round(acres).toLocaleString()} ac`;
}

export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}
