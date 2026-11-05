import {
  angleDiff,
  bearingBetween,
  bearingVector,
  cellAt,
  clamp,
  compassWord,
  M_TO_YD,
  smoothstep,
  stepYards,
  vectorBearing,
  yardsBetween,
  type LngLat,
} from './geo';
import type { Terrain } from './terrain';
import type { ThermalField } from './thermal';
import type { WindField } from './wind';
import { ThermalState, type WeatherHour } from './types';

/**
 * Where a hunter's scent goes from each cell: the ground-level wind plus the
 * thermal flow, added as vectors. The prototype checked wind and thermals one
 * at a time; adding them lets a 3 mph breeze and a strong evening drain fight,
 * which is exactly the hour scent gets unpredictable.
 */

export enum ScentDriver {
  Wind = 0,
  Thermal = 1,
  Swirl = 2,
}

export interface ScentField {
  driftBearing: Float32Array;
  driftMph: Float32Array;
  /** Full width of the scent cone, degrees. */
  spreadDeg: Float32Array;
  driver: Uint8Array;
  /** How fast scent thins along the ground, per 100 yards (exponential rate). */
  decay: Float32Array;
  /**
   * Drift as smooth east/north components (mph), lightly blurred across neighbouring
   * cells. The plume tracer reads these with bilinear interpolation so the path bends
   * continuously instead of snapping to the grid.
   */
  driftEast: Float32Array;
  driftNorth: Float32Array;
}

/** 3x3 binomial blur (1-2-1 each way), edges clamped. Cheap Gaussian stand-in. */
function blur3(src: Float32Array, cols: number, rows: number): Float32Array {
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  const w = [0.25, 0.5, 0.25];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      let a = 0;
      for (let d = -1; d <= 1; d++) a += w[d + 1] * src[r * cols + clamp(c + d, 0, cols - 1)];
      tmp[r * cols + c] = a;
    }
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      let a = 0;
      for (let d = -1; d <= 1; d++) a += w[d + 1] * tmp[clamp(r + d, 0, rows - 1) * cols + c];
      out[r * cols + c] = a;
    }
  return out;
}

/** Bilinear sample of a cell-centred field at a point; null off the grid. */
function sampleField(g: Terrain['grid'], f: Float32Array, [lng, lat]: LngLat): number | null {
  if (lng < g.west || lng > g.east || lat < g.south || lat > g.north) return null;
  const fx = clamp(((lng - g.west) / (g.east - g.west)) * g.cols - 0.5, 0, g.cols - 1);
  const fy = clamp(((g.north - lat) / (g.north - g.south)) * g.rows - 0.5, 0, g.rows - 1);
  const c0 = Math.min(Math.floor(fx), g.cols - 2 < 0 ? 0 : g.cols - 2);
  const r0 = Math.min(Math.floor(fy), g.rows - 2 < 0 ? 0 : g.rows - 2);
  const c1 = Math.min(c0 + 1, g.cols - 1);
  const r1 = Math.min(r0 + 1, g.rows - 1);
  const tx = fx - c0;
  const ty = fy - r0;
  const top = f[r0 * g.cols + c0] * (1 - tx) + f[r0 * g.cols + c1] * tx;
  const bot = f[r1 * g.cols + c0] * (1 - tx) + f[r1 * g.cols + c1] * tx;
  return top * (1 - ty) + bot * ty;
}

/** 10 m forecast wind to roughly nose height in cover (log profile, rough ground). */
export const GROUND_WIND = 0.55;

export function computeScent(t: Terrain, wind: WindField, thermal: ThermalField, weather: WeatherHour): ScentField {
  const n = t.slopeDeg.length;
  const driftBearing = new Float32Array(n);
  const driftMph = new Float32Array(n);
  const spreadDeg = new Float32Array(n);
  const driver = new Uint8Array(n);
  const decay = new Float32Array(n);
  const rawE = new Float32Array(n);
  const rawN = new Float32Array(n);
  const gustiness = clamp(
    ((weather.gustMph ?? weather.windMph) - weather.windMph) / Math.max(weather.windMph, 3),
    0,
    1,
  );

  for (let i = 0; i < n; i++) {
    const groundWind = wind.mph[i] * GROUND_WIND;
    const [we, wn] = bearingVector(wind.fromDeg[i] + 180, groundWind);
    const tb = thermal.flowBearing[i];
    const ts = Number.isFinite(tb) ? thermal.speedMph[i] : 0;
    const [te, tn] = ts ? bearingVector(tb, ts) : [0, 0];
    const e = we + te;
    const no = wn + tn;
    const speed = Math.hypot(e, no);

    const st = thermal.state[i];
    const lifting = st === ThermalState.Rising && !Number.isFinite(tb) && thermal.strength[i] > 0.4 && groundWind < 1.5;
    const opposed =
      ts > 0.7 &&
      groundWind > 0.7 &&
      angleDiff(tb, wind.fromDeg[i] + 180) > 120 &&
      ts / groundWind > 0.6 &&
      ts / groundWind < 1.6;
    const swirl = speed < 0.8 || wind.eddy[i] === 1 || opposed || lifting;

    rawE[i] = e;
    rawN[i] = no;
    driftBearing[i] = speed > 0.05 ? vectorBearing(e, no) : wind.fromDeg[i] + 180;
    driftMph[i] = speed;
    driver[i] = swirl ? ScentDriver.Swirl : ts > groundWind ? ScentDriver.Thermal : ScentDriver.Wind;
    spreadDeg[i] = swirl
      ? 140
      : clamp(22 + 30 * gustiness + 45 * smoothstep(3, 0.8, speed) + (wind.sheltered[i] ? 15 : 0), 15, 120);

    let k = 0.38;
    if (st === ThermalState.Rising) k += 0.6 * thermal.strength[i];
    else if (st === ThermalState.Pooling) k -= 0.15 * thermal.strength[i];
    else if (st === ThermalState.Sinking) k -= 0.05 * thermal.strength[i];
    if (swirl) k += 0.3;
    decay[i] = Math.max(0.15, k);
  }
  const driftEast = blur3(rawE, t.grid.cols, t.grid.rows);
  const driftNorth = blur3(rawN, t.grid.cols, t.grid.rows);
  return { driftBearing, driftMph, spreadDeg, driver, decay, driftEast, driftNorth };
}

export interface Plume {
  /** Centerline of the scent stream, starting at the source. */
  path: LngLat[];
  /** Distance along the path for each point, yards. */
  along: number[];
  /** Half-width of the cone at each point, yards. */
  halfWidth: number[];
  /** Closed polygon ring for drawing the cone. */
  ring: LngLat[];
  reachYards: number;
  /** Why the trace stopped. */
  end: 'faded' | 'edge' | 'max';
  /** Driver at the source cell. */
  driver: ScentDriver;
}

export interface PlumeOptions {
  maxYards?: number;
  /** Ground concentration (1 at the source) below which a deer won't wind you. Default 0.15. */
  threshold?: number;
}

/**
 * Follow scent downstream from a point through the drift field. The path bends
 * where the drift bends: down a draw, over a ridge, into a pocket.
 */
export function tracePlume(t: Terrain, scent: ScentField, source: LngLat, opts: PlumeOptions = {}): Plume {
  const maxYards = opts.maxYards ?? 600;
  const threshold = opts.threshold ?? 0.15;
  // Quarter-cell steps with a midpoint (RK2) integrator over bilinear-interpolated drift:
  // the path follows the smoothed flow field like a particle, so it curves with the ground.
  const step = Math.max(3, t.cellM * M_TO_YD * 0.25);
  const g = t.grid;
  const path: LngLat[] = [source];
  const along = [0];
  const halfWidth = [0];
  const start = cellAt(g, source);
  const driver = start == null ? ScentDriver.Wind : (scent.driver[start] as ScentDriver);
  let conc = 1;
  let dist = 0;
  let spreadSum = 0;
  let p = source;
  let end: Plume['end'] = 'max';
  let heading = start == null ? 0 : scent.driftBearing[start];

  /** Unit-ish flow heading at a point, or the previous heading when the air is dead still. */
  const flowAt = (q: LngLat, prev: number): number | null => {
    const e = sampleField(g, scent.driftEast, q);
    const nn = sampleField(g, scent.driftNorth, q);
    if (e == null || nn == null) return null;
    return Math.hypot(e, nn) > 0.05 ? vectorBearing(e, nn) : prev;
  };

  while (dist < maxYards) {
    if (cellAt(g, p) == null) {
      end = 'edge';
      break;
    }
    const decay = sampleField(g, scent.decay, p) ?? 0.4;
    conc *= Math.exp((-decay * step) / 100);
    if (conc < threshold) {
      end = 'faded';
      break;
    }
    const h1 = flowAt(p, heading);
    if (h1 == null) {
      end = 'edge';
      break;
    }
    const h2 = flowAt(stepYards(p, h1, step / 2), h1) ?? h1;
    // Air that turns back on itself has pooled in a low spot: the scent stops travelling.
    if (path.length > 1 && angleDiff(h2, heading) > 100) {
      end = 'faded';
      break;
    }
    heading = h2;
    p = stepYards(p, h2, step);
    dist += step;
    spreadSum += sampleField(g, scent.spreadDeg, p) ?? 60;
    const meanSpread = spreadSum / path.length;
    path.push(p);
    along.push(dist);
    halfWidth.push(Math.min(dist * Math.tan(((Math.min(meanSpread, 150) / 2) * Math.PI) / 180), 250));
  }

  const left: LngLat[] = [];
  const right: LngLat[] = [];
  for (let k = 0; k < path.length; k++) {
    const a = path[Math.max(0, k - 1)];
    const b = path[Math.min(path.length - 1, k + 1)];
    const heading = a === b ? 0 : bearingBetween(a, b);
    left.push(stepYards(path[k], heading - 90, halfWidth[k]));
    right.push(stepYards(path[k], heading + 90, halfWidth[k]));
  }
  const ring = [...left, ...right.reverse(), left[0]];
  return { path, along, halfWidth, ring, reachYards: dist, end, driver };
}

/** Is `target` inside the plume's cone? Returns the yards along the plume where it is hit, or null. */
export function plumeHits(plume: Plume, target: LngLat, padYards = 20): number | null {
  let best: number | null = null;
  for (let k = 1; k < plume.path.length; k++) {
    const d = yardsBetween(plume.path[k], target);
    if (d <= plume.halfWidth[k] + padYards && (best == null || plume.along[k] < best)) best = plume.along[k];
  }
  return best;
}

/** Points every `spacing` yards along a polyline, ends included. */
export function resample(line: LngLat[], spacing: number): LngLat[] {
  if (line.length < 2) return line.slice();
  const out: LngLat[] = [line[0]];
  let carry = 0;
  for (let k = 1; k < line.length; k++) {
    const a = line[k - 1];
    const b = line[k];
    const seg = yardsBetween(a, b);
    const bearing = bearingBetween(a, b);
    let d = spacing - carry;
    while (d <= seg) {
      out.push(stepYards(a, bearing, d));
      d += spacing;
    }
    carry = seg - (d - spacing);
  }
  const last = line[line.length - 1];
  if (yardsBetween(out[out.length - 1], last) > 1) out.push(last);
  return out;
}

export type ScentCause = 'wind' | 'rising' | 'sinking' | 'swirl';

export interface ScentHit {
  from: LngLat;
  bed: LngLat;
  /** Straight-line yards from the walk-in point to the bed. */
  yards: number;
  cause: ScentCause;
}

export interface ApproachCheck {
  level: 'idle' | 'clear' | 'warn';
  title: string;
  detail: string;
  hits: ScentHit[];
}

function causeAt(t: Terrain, scent: ScentField, thermal: ThermalField, p: LngLat): ScentCause {
  const c = cellAt(t.grid, p);
  if (c == null) return 'wind';
  if (scent.driver[c] === ScentDriver.Swirl) return 'swirl';
  if (scent.driver[c] === ScentDriver.Thermal) return thermal.state[c] === ThermalState.Rising ? 'rising' : 'sinking';
  return 'wind';
}

/**
 * The prototype's walk-in check, run on traced plumes: sample the route every
 * 70 yards, trace scent from each sample, and flag any bed inside the cone.
 */
export function checkApproach(
  t: Terrain,
  scent: ScentField,
  thermal: ThermalField,
  route: LngLat[],
  beds: LngLat[],
  opts: { spacingYards?: number; maxYards?: number } = {},
): ApproachCheck {
  if (route.length < 2)
    return {
      level: 'idle',
      title: 'No approach marked',
      detail: "Draw your walk in and I'll say if your scent hits a bed.",
      hits: [],
    };
  if (!beds.length)
    return {
      level: 'idle',
      title: 'No bed plotted yet',
      detail: 'Read the ground first, or drop a bed pin you already trust.',
      hits: [],
    };

  const hits: ScentHit[] = [];
  for (const p of resample(route, opts.spacingYards ?? 70)) {
    const plume = tracePlume(t, scent, p, { maxYards: opts.maxYards ?? 600 });
    for (const bed of beds) {
      const yards = yardsBetween(p, bed);
      if (yards < 20) continue;
      if (plumeHits(plume, bed) == null) continue;
      hits.push({ from: p, bed, yards, cause: causeAt(t, scent, thermal, p) });
    }
  }
  if (!hits.length)
    return {
      level: 'clear',
      title: 'Your walk in stays clean',
      detail: "At this hour your scent doesn't reach any plotted bed.",
      hits,
    };

  hits.sort((a, b) => a.yards - b.yards);
  const h = hits[0];
  const yd = Math.round(h.yards / 10) * 10;
  const dir = compassWord(bearingBetween(h.from, h.bed));
  const copy: Record<ScentCause, [string, string]> = {
    wind: [
      'Wind is blowing you into a bed',
      `Scent travels ${dir} toward bedding about ${yd} yards out. Swing to the downwind side.`,
    ],
    rising: [
      'Scent will climb into bedding',
      `The sun is on this slope. Thermals carry you up toward a bed about ${yd} yards ${dir}.`,
    ],
    sinking: [
      'Scent drains downhill into bedding',
      `Air is sliding off this ground toward a bed about ${yd} yards ${dir}. Come in from below or wait for the flip.`,
    ],
    swirl: [
      'Air is swirling near a bed',
      `Wind and thermals are fighting here. Scent goes every direction within about ${yd} yards of bedding.`,
    ],
  };
  const [title, detail] = copy[h.cause];
  return { level: 'warn', title, detail, hits };
}
