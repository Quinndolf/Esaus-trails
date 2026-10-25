import { analyzeTerrain, type Terrain } from '../model/terrain';
import { clamp, smoothstep } from '../model/geo';
import type { GroundGrid } from '../esau/types';
import type { Landform, SpotReading } from '../esau/types';

/**
 * Where American ginseng is most likely to grow, from habitat factors that published sources agree on.
 * The score is a RELATIVE likelihood for ranking ground against nearby ground. It is not calibrated
 * against surveys and it is not a probability that a plant is there: it cannot see the understory,
 * the soil, how old the stand is, or whether somebody already dug it.
 *
 * Factors and where they come from:
 *  - aspect: north and east faces; Apsley and Carroll 2013 (OSU F-58), Anderson et al. 2002, Sheban and Duguid 2021
 *  - slope: roughly 10-40% grade (about 6-22 degrees), up to 60%; Anderson et al. 2002
 *  - canopy: dense shade under hardwoods; 70% or more (F-58), 86-96% in Sheban and Duguid 2021;
 *    NLCD deciduous and mixed forest score, evergreen and open ground do not
 *  - position and moisture: sheltered coves and the lower slope, moist but well drained, not flooded
 *    bottoms or poorly drained ground; F-58, Anderson et al. 2002
 *  - soil: NOT SCORED here. The app has no soil layer yet, and soil showed little effect in Sheban and
 *    Duguid. Esau tells the hunter what to look for (indicator plants) instead.
 *  - absolute elevation: NOT SCORED. Kentucky's range of elevations is narrow and no published figure
 *    was found; position on the slope stands in for it.
 */

export const GINSENG_CITATIONS: Record<string, string> = {
  anderson02:
    'Anderson, R.C., M.R. Anderson and G. Houseman. 2002. Wild American ginseng. Native Plants Journal 3(2).',
  osuF58:
    'Apsley, D. and C. Carroll. 2013. Growing American Ginseng in Ohio: Selecting a Site. Ohio State University Extension Fact Sheet F-58.',
  sheban21:
    'Sheban, L. and M. Duguid. 2021. Importance of environmental factors on plantings of wild-simulated American ginseng. Agroforestry Systems (USDA SARE project GNE19-221).',
};

export interface Site {
  /** Direction the slope faces, degrees. Null on flat ground. */
  aspectDeg: number | null;
  slopeDeg: number;
  /** NLCD class code. */
  coverCode: number;
  /** -1 hollow ... 1 ridge, as in src/model/terrain. */
  position: number;
  /** 0-1 flow accumulation: draws and creek channels are high. */
  drainage: number;
}

export interface GinsengFactors {
  cover: number;
  aspect: number;
  slope: number;
  position: number;
  moisture: number;
  /** 0-1 relative likelihood. */
  score: number;
}

export type GinsengClass = 'high' | 'good' | 'fair' | 'poor';

const COVER_GATE: Record<number, number> = { 41: 1, 43: 0.8, 42: 0.25, 90: 0.3, 52: 0.1, 95: 0.05 };
const WEIGHTS = { aspect: 0.3, slope: 0.2, position: 0.25, moisture: 0.25 };

const coverGate = (code: number) => COVER_GATE[code] ?? 0.02;

/** Facing northeast is best; due south is worst. */
export function aspectFactor(aspectDeg: number | null, slopeDeg: number): number {
  if (aspectDeg === null || slopeDeg < 3) return 0.45; // flat ground has no aspect to favor
  return 0.5 + 0.5 * Math.cos(((aspectDeg - 30) * Math.PI) / 180);
}

export function slopeFactor(slopeDeg: number): number {
  const rise = smoothstep(1, 6, slopeDeg); // flat ground drains poorly and floods
  const fall = 1 - 0.65 * smoothstep(22, 31, slopeDeg) - 0.2 * smoothstep(31, 40, slopeDeg);
  return clamp(0.25 + 0.75 * rise, 0, 1) * clamp(fall, 0.15, 1);
}

/** Lower third of the slope and sheltered coves; ridge tops are out. */
export function positionFactor(position: number, slopeDeg: number): number {
  const bell = 1 - clamp(Math.abs(position + 0.25) / 0.95, 0, 1);
  const flooded = position < -0.6 && slopeDeg < 3 ? 0.4 : 1;
  return Math.max(0.05, bell) * flooded;
}

/** Moist but well drained: moderate flow accumulation. The channel itself is too wet, a dry knob too dry. */
export function moistureFactor(drainage: number): number {
  return 0.25 + 0.75 * Math.exp(-(((drainage - 0.3) / 0.28) ** 2));
}

export function ginsengFactors(s: Site): GinsengFactors {
  const cover = coverGate(s.coverCode);
  const aspect = aspectFactor(s.aspectDeg, s.slopeDeg);
  const slope = slopeFactor(s.slopeDeg);
  const position = positionFactor(s.position, s.slopeDeg);
  const moisture = moistureFactor(s.drainage);
  const raw = WEIGHTS.aspect * aspect + WEIGHTS.slope * slope + WEIGHTS.position * position + WEIGHTS.moisture * moisture;
  return { cover, aspect, slope, position, moisture, score: clamp(cover * raw, 0, 1) };
}

export function ginsengClass(score: number): GinsengClass {
  if (score >= 0.62) return 'high';
  if (score >= 0.45) return 'good';
  if (score >= 0.3) return 'fair';
  return 'poor';
}

export const CLASS_WORDS: Record<GinsengClass, string> = {
  high: 'best ground on this map for ginseng',
  good: 'good ginseng habitat on paper',
  fair: 'possible, but not the ground I would start with',
  poor: 'not ginseng ground',
};

// --- A whole grid, for the map layer ---

export interface GinsengField {
  score: Float32Array;
  terrain: Terrain;
  factorsAt(i: number): GinsengFactors;
}

const NLCD_CANOPY: Record<number, number> = { 41: 80, 42: 80, 43: 75, 90: 65, 52: 20, 95: 10 };
const fields = new WeakMap<GroundGrid, GinsengField>();

export function ginsengField(grid: GroundGrid): GinsengField {
  const hit = fields.get(grid);
  if (hit) return hit;
  const canopyPct = grid.cover?.length ? grid.cover.map((c) => NLCD_CANOPY[c] ?? 0) : undefined;
  const terrain = analyzeTerrain({ ...grid, canopyPct });
  const n = grid.cols * grid.rows;
  const score = new Float32Array(n);
  const site = (i: number): Site => ({
    aspectDeg: Number.isFinite(terrain.aspectDeg[i]) ? terrain.aspectDeg[i] : null,
    slopeDeg: terrain.slopeDeg[i],
    coverCode: grid.cover?.[i] ?? 0,
    position: terrain.position[i],
    drainage: terrain.drainage[i],
  });
  for (let i = 0; i < n; i++) score[i] = ginsengFactors(site(i)).score;
  const field: GinsengField = { score, terrain, factorsAt: (i) => ginsengFactors(site(i)) };
  fields.set(grid, field);
  return field;
}

/** Transparent below fair, then pale green to deep emerald. */
export function ginsengPixels(score: ArrayLike<number>): Uint8ClampedArray {
  const px = new Uint8ClampedArray(score.length * 4);
  for (let i = 0; i < score.length; i++) {
    const v = score[i];
    if (v < 0.3) continue;
    const t = clamp((v - 0.3) / 0.45, 0, 1);
    px.set([Math.round(150 - 120 * t), Math.round(220 - 40 * t), Math.round(110 - 30 * t), Math.round(60 + 140 * t)], i * 4);
  }
  return px;
}

// --- One tapped spot, from what Esau's terrain read already knows ---

const LANDFORM_POSITION: Record<Landform, number> = {
  ridgetop: 1,
  point: 0.8,
  saddle: 0.55,
  'upper slope': 0.5,
  bench: 0.1,
  'mid slope': 0,
  'lower slope': -0.4,
  draw: -0.7,
  'creek bottom': -0.9,
  flat: 0,
};
const LANDFORM_DRAINAGE: Record<Landform, number> = {
  ridgetop: 0.02,
  point: 0.03,
  saddle: 0.05,
  'upper slope': 0.08,
  bench: 0.15,
  'mid slope': 0.2,
  'lower slope': 0.3,
  draw: 0.45,
  'creek bottom': 0.85,
  flat: 0.15,
};

export function siteFromSpot(spot: SpotReading): Site {
  let drainage = LANDFORM_DRAINAGE[spot.landform];
  if (spot.nearestWaterYd !== null && spot.nearestWaterYd < 40) drainage = Math.max(drainage, 0.7); // in the channel
  else if (spot.nearestWaterYd !== null && spot.nearestWaterYd < 150) drainage = Math.max(drainage, 0.3);
  return {
    aspectDeg: spot.aspectDeg,
    slopeDeg: spot.slopeDeg,
    coverCode: spot.cover.code,
    position: LANDFORM_POSITION[spot.landform],
    drainage,
  };
}

/** Plain-language reasons, best first then worst, for Esau's field report. */
export function explain(f: GinsengFactors, s: Site, aspectName?: string | null): string[] {
  const out: string[] = [];
  if (f.cover < 0.3) out.push('cover is not hardwood forest (no shade for ginseng)');
  else if (f.cover < 0.9) out.push('cover is conifer, mixed or wet woods rather than hardwood');
  else out.push('hardwood forest cover');
  if (s.aspectDeg === null || s.slopeDeg < 3) out.push('flat, so no cool aspect to lean on');
  else out.push(`${aspectName ?? 'slope'} face (${f.aspect >= 0.7 ? 'cool, favorable' : f.aspect >= 0.4 ? 'middling' : 'hot, unfavorable'})`);
  out.push(`${Math.round(s.slopeDeg)}° slope (${f.slope >= 0.8 ? 'in the range' : s.slopeDeg < 6 ? 'too flat' : 'too steep'})`);
  out.push(f.position >= 0.7 ? 'lower slope or cove position' : s.position > 0.4 ? 'ridge or upper slope, too high and dry' : 'middling position on the slope');
  out.push(f.moisture >= 0.7 ? 'moist but drained' : s.drainage > 0.55 ? 'in or beside a channel, likely too wet' : 'on the dry side');
  return out;
}
