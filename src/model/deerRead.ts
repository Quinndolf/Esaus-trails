import type { GroundGrid, Pin } from '../esau/types';
import { conditionsForGrid } from './esau';
import { readFood } from './food';
import { cellAt, yardsBetween, type LngLat } from './geo';
import { createMovementModel, type MovementModel } from './movement';

const models = new WeakMap<GroundGrid, MovementModel>();
const COMPASS = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];

function bearing([lng1, lat1]: LngLat, [lng2, lat2]: LngLat) {
  const r = Math.PI / 180;
  const y = Math.sin((lng2 - lng1) * r) * Math.cos(lat2 * r);
  const x = Math.cos(lat1 * r) * Math.sin(lat2 * r) - Math.sin(lat1 * r) * Math.cos(lat2 * r) * Math.cos((lng2 - lng1) * r);
  return ((Math.atan2(y, x) / r) + 360) % 360;
}
const where = (from: LngLat, to: LngLat) =>
  `${Math.round(yardsBetween(from, to))} yd ${COMPASS[Math.round(bearing(from, to) / 45) % 8]}`;

/**
 * The deer model's predictions around a tapped spot, as lines for Esau's field report:
 * predicted food, the nearest predicted beds, predicted trails, and what deer are doing this hour.
 * Returns [] if the model cannot run (no usable forecast hour).
 */
export function deerPredictionLines(grid: GroundGrid, spot: LngLat, date: Date, pins: Pin[] = []): string[] {
  try {
    const hc = conditionsForGrid(grid).at(date);
    let model = pins.length ? null : models.get(grid);
    if (!model) {
      model = createMovementModel(grid, pins);
      if (!pins.length) models.set(grid, model);
    }
    const m = model.at(hc.sun, hc.weather, hc.wind, hc.atmosphere.movementFactor, date);
    const lines: string[] = [];
    lines.push(...(readFood(grid, spot, date)?.lines ?? []));
    lines.push('');
    lines.push('PREDICTED BEDS AND TRAILS (modelled from food, terrain, wind and thermals; a prediction, not sign on the ground)');
    const beds = [...m.beds].sort((a, b) => yardsBetween(spot, a.lngLat) - yardsBetween(spot, b.lngLat)).slice(0, 3);
    if (beds.length) lines.push(`Likely bedding: ${beds.map((b) => `${where(spot, b.lngLat)} (score ${Math.round(b.score * 100)})`).join('; ')}.`);
    else lines.push('No strong bedding stands out on this map.');
    let nearTrail: { yd: number; at: LngLat } | null = null;
    for (const t of m.trails) for (const p of t.coordinates) {
      const yd = yardsBetween(spot, p);
      if (!nearTrail || yd < nearTrail.yd) nearTrail = { yd, at: p };
    }
    if (nearTrail) lines.push(`Nearest predicted trail between food and bed: ${nearTrail.yd < 15 ? 'right here' : where(spot, nearTrail.at)}.`);
    const i = cellAt(grid, spot);
    if (i != null) lines.push(`Deer presence at this spot this hour: ${Math.round(m.presence[i]! * 100)}% of the map's best. ${m.line}`);
    return lines;
  } catch {
    return [];
  }
}
