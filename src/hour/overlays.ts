import { bearingVector, cellCenter, stepYards, type LngLat } from '../model/geo';
import type { HourConditions } from '../model/conditions';
import type { MovementHour } from '../model/movement';
import type { Plume } from '../model/scent';
import { ThermalState, type ElevationGrid } from '../model/types';

/**
 * Turns one hour of the model into things MapLibre can draw: small RGBA images
 * stretched over the grid (MapLibre's linear resampling smooths them), and
 * GeoJSON for arrows, trails, beds and the scent cone.
 */

export type Rgba = [number, number, number];

// Rising is warm, sinking cool, pooling deep blue: the prototype's palette.
const THERMAL_RGB: Record<ThermalState, Rgba> = {
  [ThermalState.Settled]: [0, 0, 0],
  [ThermalState.Rising]: [255, 138, 40],
  [ThermalState.Sinking]: [70, 160, 255],
  [ThermalState.Pooling]: [40, 70, 210],
};

export function thermalPixels(hc: HourConditions): Uint8ClampedArray {
  const n = hc.thermal.state.length;
  const px = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) {
    const st = hc.thermal.state[i] as ThermalState;
    const [r, g, b] = THERMAL_RGB[st];
    px.set([r, g, b, st === ThermalState.Settled ? 0 : Math.round(70 + 170 * hc.thermal.strength[i])], i * 4);
  }
  return px;
}

/** Where deer likely are this hour: transparent to hot red. */
export function presencePixels(m: MovementHour): Uint8ClampedArray {
  const n = m.presence.length;
  const px = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) {
    const v = m.presence[i];
    if (v < 0.3) continue;
    const t = (v - 0.3) / 0.7;
    px.set([255, Math.round(210 - 170 * t), 40, Math.round(30 + 170 * t)], i * 4);
  }
  return px;
}

/** Predicted food this season: amber acorn ground, green crops, teal browse. Fainter than deer presence. */
const FOOD_RGB: Rgba[] = [[0, 0, 0], [232, 150, 30], [110, 200, 70], [70, 170, 160]];
export function foodPixels(m: MovementHour): Uint8ClampedArray {
  const n = m.food.length;
  const px = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) {
    const v = m.food[i];
    const k = m.foodKind[i];
    if (!k || v < 0.3) continue;
    const [r, g, b] = FOOD_RGB[k];
    px.set([r, g, b, Math.round(40 + 140 * Math.min(1, (v - 0.3) / 0.7))], i * 4);
  }
  return px;
}

/** Corners for a MapLibre image source: top-left, top-right, bottom-right, bottom-left. */
export function imageCorners(g: ElevationGrid): [LngLat, LngLat, LngLat, LngLat] {
  return [
    [g.west, g.north],
    [g.east, g.north],
    [g.east, g.south],
    [g.west, g.south],
  ];
}

type FC = GeoJSON.FeatureCollection;
const line = (coordinates: LngLat[], properties: Record<string, unknown> = {}): GeoJSON.Feature => ({
  type: 'Feature',
  properties,
  geometry: { type: 'LineString', coordinates },
});

/** Downwind arrows on a coarse lattice, length by local speed, flagged where the lee eddies. */
export function windArrows(g: ElevationGrid, hc: HourConditions, every = 4): FC {
  const features: GeoJSON.Feature[] = [];
  const half = Math.floor(every / 2);
  for (let r = half; r < g.rows; r += every) {
    for (let c = half; c < g.cols; c += every) {
      const i = r * g.cols + c;
      const mph = hc.wind.mph[i];
      if (mph < 0.8) continue;
      const toward = hc.wind.fromDeg[i] + 180;
      const len = 60 + Math.min(110, mph * 8); // yards
      const center = cellCenter(g, i);
      const tail = stepYards(center, toward + 180, len / 2);
      const tip = stepYards(center, toward, len / 2);
      const head = len * 0.32;
      const props = { mph: Math.round(mph), eddy: hc.wind.eddy[i] === 1 };
      features.push(line([tail, tip], props));
      features.push(line([stepYards(tip, toward + 150, head), tip, stepYards(tip, toward - 150, head)], props));
    }
  }
  return { type: 'FeatureCollection', features };
}

/** Short ticks showing which way thermal air slides, on cells where it's strong. */
export function thermalTicks(g: ElevationGrid, hc: HourConditions, every = 3): FC {
  const features: GeoJSON.Feature[] = [];
  for (let r = 1; r < g.rows; r += every) {
    for (let c = 1; c < g.cols; c += every) {
      const i = r * g.cols + c;
      const b = hc.thermal.flowBearing[i];
      if (!Number.isFinite(b) || hc.thermal.strength[i] < 0.35) continue;
      const center = cellCenter(g, i);
      const tip = stepYards(center, b, 18);
      features.push(
        line([stepYards(center, b + 180, 18), tip, stepYards(tip, b + 145, 9)], { state: hc.thermal.state[i] }),
      );
    }
  }
  return { type: 'FeatureCollection', features };
}

export function trailLines(m: MovementHour): FC {
  return {
    type: 'FeatureCollection',
    features: m.trails.map((t) => line(t.coordinates, { weight: t.weight * (0.35 + 0.65 * m.activity.moving * 2) })),
  };
}

export function bedPoints(m: MovementHour): FC {
  return {
    type: 'FeatureCollection',
    features: m.beds.map((b) => ({
      type: 'Feature',
      properties: { score: Math.round(b.score * 100), bedded: m.activity.bedded },
      geometry: { type: 'Point', coordinates: b.lngLat },
    })),
  };
}

export function plumePolygon(p: Plume | null): FC {
  if (!p || p.path.length < 2) return { type: 'FeatureCollection', features: [] };
  return {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', properties: { driver: p.driver }, geometry: { type: 'Polygon', coordinates: [p.ring] } },
      line(p.path, { driver: p.driver }),
    ],
  };
}

/** Bearing-and-speed vector for a compact wind glyph in the panel. */
export const windGlyph = (fromDeg: number) => bearingVector(fromDeg + 180, 1);
