import { angleDiff, bearingBetween, cardinal, cellAt, stepYards, yardsBetween, type LngLat } from './geo';
import type { Bed, Trail } from './movement';
import type { ElevationGrid } from './types';

/**
 * The three best places to sit for the hour: downwind of where deer are predicted to travel, at a
 * range the weapon can use, without scent drifting over a predicted bed. Pure: it reads the movement
 * model's trails and beds and the wind, and changes nothing. A prediction, not sign on the ground.
 */

export type Weapon = 'bow' | 'crossbow' | 'pellet' | 'shotgun' | 'muzzleloader' | 'rifle';

/**
 * Where the weapon is best used, and the farthest it is worth trusting, in yards.
 * Spots are placed at `ideal` from a trail point; `max` only limits which traffic counts
 * (the pellet gun's working range is 40 yd, the squirrel rule, so that is its `max`).
 */
export const WEAPON_RANGE_YD: Record<Weapon, { ideal: number; max: number }> = {
  bow: { ideal: 20, max: 35 },
  crossbow: { ideal: 25, max: 45 },
  pellet: { ideal: 25, max: 40 },
  shotgun: { ideal: 40, max: 70 },
  muzzleloader: { ideal: 80, max: 140 },
  rifle: { ideal: 100, max: 220 },
};

/** Scent is treated as reaching animals within this half-angle of downwind: the 42 degree plume plus slack for wind that swirls and shifts. */
export const SCENT_CONE_DEG = 62;
/** A bed this close and downwind of the hunter is ruled out. */
export const BED_BUST_YD = 150;
const MIN_SPACING_YD = 100;
/** Animals this close to the hunter are on top of the stand, not in range. */
const TOO_CLOSE_YD = 8;
/** Trail points closer than this are the same point for ranking; keeps the work small. */
const THIN_YD = 25;
/** Deer smelling the hunter still count a little, never a lot. */
const SMELLED_FACTOR = 0.1;
/** A bed within this distance is busted by a hunter even with the wind right. */
const NEAR_BED_YD = 60;
const NEAR_BED_FACTOR = 0.4;
const ON_AXIS_FACTOR = 0.5;
const ON_AXIS_DEG = 30;
const APPROACH_FACTOR = 0.6;
/** Best total traffic below this is "not sure": under half of one trail point at ideal range and full weight. */
export const UNSURE_BELOW = 0.5;
const BEARINGS = [0, 45, 90, 135, 180, 225, 270, 315];

export interface SitSpot {
  rank: number;
  lngLat: LngLat;
  /** Which way to face: toward the traffic. */
  watchBearingDeg: number;
  /** 0-1 against the best spot found. */
  score: number;
  /** Yards to the predicted trail (deer) or to the nearest food trees (squirrel; see `kind`). */
  yardsToTrail: number;
  reason: string;
  /** What the spot is built around. Absent means a deer trail. */
  kind?: 'trail' | 'food_trees';
}

export interface SitSpotInput {
  grid: ElevationGrid;
  trails: Trail[];
  beds: Bed[];
  /** Direction the wind blows FROM at a cell index. */
  windFromDeg: (cell: number) => number;
  weapon: Weapon;
  /** If given, an approach that walks scent over a bed is marked down. */
  hunter?: LngLat;
  max?: number;
}

export interface SitSpotResult {
  spots: SitSpot[];
  /** True when the ground gave nothing strong to go on. */
  unsure: boolean;
}

export function topSitSpots(input: SitSpotInput): SitSpotResult {
  const { grid, trails, beds, weapon } = input;
  const { ideal, max: reach } = WEAPON_RANGE_YD[weapon];
  const points = thin(trails);
  const flat = trails.flatMap((t) => t.coordinates);
  const limit = Math.max(0, Math.floor(input.max ?? 3));
  if (!points.length || !limit) return { spots: [], unsure: true };

  const towardOf = (at: LngLat) => {
    const i = cellAt(grid, at);
    return i == null ? null : (input.windFromDeg(i) + 180) % 360;
  };
  const bedDownwind = (at: LngLat, toward: number) =>
    beds.some((b) => yardsBetween(at, b.lngLat) <= BED_BUST_YD && angleDiff(bearingBetween(at, b.lngLat), toward) <= SCENT_CONE_DEG);

  type Cand = { at: LngLat; traffic: number; best: { p: LngLat; gain: number }; wind: number };
  const cands: Cand[] = [];
  const seen = new Set<string>();
  for (const { p } of points) {
    for (const b of BEARINGS) {
      const at = stepYards(p, b, ideal);
      const key = `${at[0].toFixed(5)},${at[1].toFixed(5)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const toward = towardOf(at);
      if (toward == null || bedDownwind(at, toward)) continue;
      let traffic = 0;
      let best = { p, gain: 0 };
      for (const q of points) {
        const d = yardsBetween(at, q.p);
        if (d > reach) continue;
        const quality = d < TOO_CLOSE_YD ? 0 : Math.max(0, 1 - Math.abs(d - ideal) / reach);
        // Deer whose nose is in your scent are not coming past.
        const smelled = d > 3 && angleDiff(bearingBetween(at, q.p), toward) <= SCENT_CONE_DEG;
        const gain = q.w * quality * (smelled ? SMELLED_FACTOR : 1);
        traffic += gain;
        if (gain > best.gain) best = { p: q.p, gain };
      }
      if (traffic <= 0) continue;
      // Too close to a bed busts it even with the wind right.
      if (beds.some((bd) => yardsBetween(at, bd.lngLat) < NEAR_BED_YD)) traffic *= NEAR_BED_FACTOR;
      // Straight down the trail's line is where deer walk at you; off to the side is a sit.
      if (onTrailAxis(at, trails, flat)) traffic *= ON_AXIS_FACTOR;
      if (input.hunter && approachCrossesBed(input.hunter, at, toward, beds)) traffic *= APPROACH_FACTOR;
      cands.push({ at, traffic, best, wind: (toward + 180) % 360 });
    }
  }
  if (!cands.length) return { spots: [], unsure: true };

  cands.sort((a, b) => b.traffic - a.traffic);
  const top = cands[0]!.traffic;
  const picked: Cand[] = [];
  for (const c of cands) {
    if (picked.some((q) => yardsBetween(q.at, c.at) < MIN_SPACING_YD)) continue;
    picked.push(c);
    if (picked.length >= limit) break;
  }
  const spots = picked.map((c, k): SitSpot => {
    const watch = bearingBetween(c.at, c.best.p);
    const yards = Math.round(yardsBetween(c.at, c.best.p));
    return {
      rank: k + 1,
      lngLat: c.at,
      watchBearingDeg: Math.round(watch) % 360,
      score: c.traffic / top,
      yardsToTrail: yards,
      reason: `Predicted trail ${yards} yd ${cardinal(watch)}; wind from the ${cardinal(c.wind)} carries your scent away from it.`,
    };
  });
  return { spots, unsure: top < UNSURE_BELOW };
}

/** Keep one point per THIN_YD of trail, so a dense line does not cost more than a sparse one. */
function thin(trails: Trail[]): { p: LngLat; w: number }[] {
  const out: { p: LngLat; w: number }[] = [];
  for (const t of trails) {
    let last: LngLat | null = null;
    for (const p of t.coordinates) {
      if (last && yardsBetween(last, p) < THIN_YD) continue;
      out.push({ p, w: t.weight });
      last = p;
    }
  }
  return out;
}

/**
 * Walking in from `from`, does scent blow over a bed at any step? An approximation: it uses the
 * wind at the spot for the whole walk and samples every 25 yd, so a bed just off the path can slip by.
 */
function approachCrossesBed(from: LngLat, to: LngLat, toward: number, beds: Bed[]): boolean {
  const total = yardsBetween(from, to);
  const bearing = bearingBetween(from, to);
  for (let d = 0; d <= total; d += 25) {
    const at = stepYards(from, bearing, d);
    if (beds.some((b) => yardsBetween(at, b.lngLat) <= BED_BUST_YD && angleDiff(bearingBetween(at, b.lngLat), toward) <= SCENT_CONE_DEG))
      return true;
  }
  return false;
}

/** True when `at` sits in line with the nearest stretch of trail, ahead of or behind it. */
function onTrailAxis(at: LngLat, trails: Trail[], flat: LngLat[]): boolean {
  let best: { d: number; axis: number } | null = null;
  for (const t of trails) {
    const c = t.coordinates;
    for (let k = 0; k < c.length; k++) {
      const d = yardsBetween(at, c[k]!);
      if (best && d >= best.d) continue;
      const a = c[Math.max(0, k - 1)]!;
      const b = c[Math.min(c.length - 1, k + 1)]!;
      if (a === b) continue;
      best = { d, axis: bearingBetween(a, b) };
    }
  }
  if (!best) return false;
  const nearest = flat.reduce((m, p) => (yardsBetween(at, p) < yardsBetween(at, m) ? p : m));
  const off = bearingBetween(nearest, at);
  return Math.min(angleDiff(off, best.axis), angleDiff(off, (best.axis + 180) % 360)) <= ON_AXIS_DEG;
}
