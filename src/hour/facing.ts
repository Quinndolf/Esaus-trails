import { angleDiff, bearingBetween, yardsBetween, type LngLat } from '../model/geo';
import type { Trail } from '../model/movement';

export const FACING_HALF_ANGLE = 40;
export const FACING_RANGE_YD = 400;

/**
 * The stretches of predicted trail ahead of the hunter: within the sight cone (half-angle either side of
 * the heading) and within range. Each segment is kept on its own so a trail that bends out of view is cut there.
 */
export function trailsInView(trails: Trail[], origin: LngLat, headingDeg: number, halfAngle = FACING_HALF_ANGLE, rangeYd = FACING_RANGE_YD): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const t of trails) {
    for (let i = 0; i + 1 < t.coordinates.length; i++) {
      const a = t.coordinates[i];
      const b = t.coordinates[i + 1];
      const mid: LngLat = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      if (yardsBetween(origin, mid) > rangeYd) continue;
      if (angleDiff(bearingBetween(origin, mid), headingDeg) > halfAngle) continue;
      features.push({ type: 'Feature', properties: { weight: t.weight }, geometry: { type: 'LineString', coordinates: [a, b] } });
    }
  }
  return { type: 'FeatureCollection', features };
}
