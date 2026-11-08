import { angleDiff, bearingBetween, cardinal, cellAt, cellCenter, insideBounds, stepYards, yardsBetween, type Bounds, type LngLat } from './geo';
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
/** Deer smelling the hunter still count a little, never a lot. */
const SMELLED_FACTOR = 0.1;
/**
 * Up a tree (stand or saddle, ~15-20 ft) some scent carries over deer close in, and they see you less.
 * It helps a little, never enough to sit with the wind wrong.
 */
const SMELLED_FACTOR_UP = 0.25;
const NEAR_BED_FACTOR_UP = 0.6;
/** Scent from up a tree comes back down to the ground past about this far. */
const UP_CLOSE_YD = 30;
/** A bed within this distance is busted by a hunter even with the wind right. */
const NEAR_BED_YD = 60;
const NEAR_BED_FACTOR = 0.4;
const ON_AXIS_FACTOR = 0.5;
const ON_AXIS_DEG = 30;
const APPROACH_FACTOR = 0.6;
/** Best total traffic below this is "not sure": under half of one trail point at ideal range and full weight. */
export const UNSURE_BELOW = 0.5;
const BEARINGS = [0, 45, 90, 135, 180, 225, 270, 315];
/** Trails crossing one cell at headings this far apart (as lines, 0-90) come from different directions. */
const PINCH_DEG = 35;
/** A saddle needs this much rise (m) on each side, so flat-ground noise is not a saddle. */
const SADDLE_MIN_M = 1.5;
/** Each extra direction meeting at a point adds this much to its traffic, up to two extra. */
const PINCH_BONUS = 0.6;
/** A trail crossing a saddle carries more deer than its weight says. */
const SADDLE_BONUS = 1.3;

/** Low one way and high the other, like the movement model's saddles. Interior cells only. */
export function isSaddle(grid: ElevationGrid, i: number): boolean {
  const { cols, rows } = grid;
  const r = Math.floor(i / cols), c = i % cols;
  if (r < 1 || c < 1 || r >= rows - 1 || c >= cols - 1) return false;
  const z = grid.elevationM;
  const a = z[i]!, w = z[i - 1]!, e = z[i + 1]!, no = z[i - cols]!, s = z[i + cols]!;
  const m = SADDLE_MIN_M;
  return (
    (Math.min(no, s) - a >= m && a - Math.max(w, e) >= m) || (a - Math.max(no, s) >= m && Math.min(w, e) - a >= m)
  );
}

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
  kind?: 'trail' | 'food_trees' | 'roost' | 'strut_zone';
}

/** How the hunter sits: on the ground, in a tree stand, or in a saddle. */
export type Setup = 'ground' | 'tree_stand' | 'saddle';
export const isElevated = (s: Setup | undefined) => s === 'tree_stand' || s === 'saddle';

export interface SitSpotInput {
  grid: ElevationGrid;
  trails: Trail[];
  beds: Bed[];
  /** Direction the wind blows FROM at a cell index. */
  windFromDeg: (cell: number) => number;
  weapon: Weapon;
  /** Ground (the default), tree stand or saddle. Up a tree, close deer downwind count a little more. */
  setup?: Setup;
  /** If given, an approach that walks scent over a bed is marked down. */
  hunter?: LngLat;
  max?: number;
  /** Only pick inside this box (the map on screen). Traffic from the whole grid still counts. */
  within?: Bounds;
}

export interface SitSpotResult {
  spots: SitSpot[];
  /** True when the ground gave nothing strong to go on. */
  unsure: boolean;
}

type Pt = ReturnType<typeof pinch>[number];
type Rated = { traffic: number; best: { p: LngLat; gain: number; pt: Pt }; wind: number };

/** Builds the scorer for one hour: how much traffic a hunter sitting at a point would see, with every penalty applied. */
function scorer(input: SitSpotInput) {
  const { grid, trails, beds, weapon } = input;
  const { ideal, max: reach } = WEAPON_RANGE_YD[weapon];
  const points = pinch(trails, grid);
  const flat = trails.flatMap((t) => t.coordinates);
  const up = isElevated(input.setup);
  const nearBedFactor = up ? NEAR_BED_FACTOR_UP : NEAR_BED_FACTOR;
  const towardOf = (at: LngLat) => {
    const i = cellAt(grid, at);
    return i == null ? null : (input.windFromDeg(i) + 180) % 360;
  };
  const bedDownwind = (at: LngLat, toward: number) =>
    beds.some((b) => yardsBetween(at, b.lngLat) <= BED_BUST_YD && angleDiff(bearingBetween(at, b.lngLat), toward) <= SCENT_CONE_DEG);

  /** Null when the spot is off the ground, blows scent onto a bed, or sees no deer at all. */
  const rate = (at: LngLat): Rated | null => {
    if (!points.length) return null;
    const toward = towardOf(at);
    if (toward == null || bedDownwind(at, toward)) return null;
    let traffic = 0;
    let best = { p: points[0]!.p, gain: 0, pt: points[0]! };
    for (const q of points) {
      const d = yardsBetween(at, q.p);
      if (d > reach) continue;
      const quality = d < TOO_CLOSE_YD ? 0 : Math.max(0, 1 - Math.abs(d - ideal) / reach);
      // Deer whose nose is in your scent are not coming past.
      const smelled = d > 3 && angleDiff(bearingBetween(at, q.p), toward) <= SCENT_CONE_DEG;
      const gain = q.w * quality * (smelled ? (up && d <= UP_CLOSE_YD ? SMELLED_FACTOR_UP : SMELLED_FACTOR) : 1);
      traffic += gain;
      if (gain > best.gain) best = { p: q.p, gain, pt: q };
    }
    if (traffic <= 0) return null;
    // Too close to a bed busts it even with the wind right.
    if (beds.some((bd) => yardsBetween(at, bd.lngLat) < NEAR_BED_YD)) traffic *= nearBedFactor;
    // Straight down the trail's line is where deer walk at you; off to the side is a sit.
    if (onTrailAxis(at, trails, flat)) traffic *= ON_AXIS_FACTOR;
    if (input.hunter && approachCrossesBed(input.hunter, at, toward, beds)) traffic *= APPROACH_FACTOR;
    return { traffic, best, wind: (toward + 180) % 360 };
  };
  return { points, ideal, rate };
}

/**
 * How much deer traffic a hunter sitting right here would see this hour, on the same scale `topSitSpots`
 * ranks by (0 when the wind or a bed rules the spot out). Compare it with `rateSit` at the top pick.
 */
export function rateSit(input: SitSpotInput, at: LngLat): number {
  return scorer(input).rate(at)?.traffic ?? 0;
}

export function topSitSpots(input: SitSpotInput): SitSpotResult {
  const { points, ideal, rate } = scorer(input);
  const limit = Math.max(0, Math.floor(input.max ?? 3));
  if (!points.length || !limit) return { spots: [], unsure: true };

  type Cand = Rated & { at: LngLat };
  const cands: Cand[] = [];
  const seen = new Set<string>();
  for (const { p } of points) {
    for (const b of BEARINGS) {
      const at = stepYards(p, b, ideal);
      const key = `${at[0].toFixed(5)},${at[1].toFixed(5)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const r = rate(at);
      if (r) cands.push({ at, ...r });
    }
  }
  if (input.within) {
    const box = input.within;
    for (let k = cands.length - 1; k >= 0; k--) if (!insideBounds(box, cands[k]!.at)) cands.splice(k, 1);
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
      reason: `${
        c.best.pt.meet >= 2
          ? `Pinch point: ${c.best.pt.meet} predicted trails meet ${yards} yd ${cardinal(watch)}${c.best.pt.saddle ? ' in a saddle' : ''}`
          : c.best.pt.saddle
            ? `Predicted trail crosses a saddle ${yards} yd ${cardinal(watch)}`
            : `Predicted trail ${yards} yd ${cardinal(watch)}`
      }; wind from the ${cardinal(c.wind)} carries your scent away from it.`,
    };
  });
  return { spots, unsure: top < UNSURE_BELOW };
}

/** At or above this share of the best spot within walking distance, Esau says stay. */
export const STAY_AT_PCT = 70;
/** How far a hunter will walk to a better spot just off the screen: under half a mile. */
export const WALK_YD = 800;
/** A spot off the screen has to beat the best one on it by this much to be worth the walk. */
const OFF_SCREEN_EDGE = 1.25;

export interface SitVerdict {
  /** 0-100: your spot's traffic against the best spot on screen (or just off it, within a walk). */
  pct: number;
  stay: boolean;
  /** Better sits on the screen, best first, at most three. */
  better: SitSpot[];
  /** A clearly better sit just off the screen, within walking distance. */
  offScreen?: SitSpot;
}

/**
 * Stay or move: rates the hunter's spot against the best ones on the screen (`within`), and against any
 * clearly better one just off it but within `walkYd`. Null when there is no deer traffic to judge by.
 */
export function sitVerdict(input: SitSpotInput, at: LngLat, opts: { walkYd?: number } = {}): SitVerdict | null {
  const { rate } = scorer(input);
  const trafficAt = (p: LngLat) => rate(p)?.traffic ?? 0;
  const here = trafficAt(at);
  const on = topSitSpots({ ...input, max: 3 }).spots.map((s) => ({ s, t: trafficAt(s.lngLat) }));
  let off: { s: SitSpot; t: number } | undefined;
  if (input.within) {
    const walk = opts.walkYd ?? WALK_YD;
    const reach: Bounds = {
      north: stepYards(at, 0, walk)[1],
      south: stepYards(at, 180, walk)[1],
      east: stepYards(at, 90, walk)[0],
      west: stepYards(at, 270, walk)[0],
    };
    const view = input.within;
    const top = topSitSpots({ ...input, within: reach, max: 9 }).spots.find(
      (s) => !insideBounds(view, s.lngLat) && yardsBetween(at, s.lngLat) <= walk,
    );
    const t = top ? trafficAt(top.lngLat) : 0;
    if (top && t > Math.max(here, on[0]?.t ?? 0) * OFF_SCREEN_EDGE) off = { s: top, t };
  }
  const best = Math.max(here, on[0]?.t ?? 0, off?.t ?? 0);
  if (best <= 0) return null;
  const pct = Math.round((100 * here) / best);
  const stay = pct >= STAY_AT_PCT;
  const better = on.filter((o) => o.t > here).map((o) => o.s);
  // Only a move sends the hunter off the screen.
  return { pct, stay, better, ...(off && !stay ? { offScreen: off.s } : {}) };
}

/**
 * One point per grid cell any predicted trail crosses, so trails sharing a stretch don't count it twice.
 * A pinch point is a cell where trails come in from different directions (a junction or a crossing),
 * or where a trail crosses a saddle: more deer pass there than one trail's weight says.
 */
function pinch(trails: Trail[], grid: ElevationGrid) {
  const cells = new Map<number, { p: LngLat; w: number; headings: number[] }>();
  for (const t of trails) {
    const cs = t.coordinates;
    cs.forEach((p, k) => {
      const i = cellAt(grid, p);
      if (i == null) return;
      const a = cs[Math.max(0, k - 1)]!, b = cs[Math.min(cs.length - 1, k + 1)]!;
      const heading = a === b ? null : bearingBetween(a, b) % 180; // a trail is a line: N and S are the same way
      const c = cells.get(i) ?? { p: cellCenter(grid, i) as LngLat, w: 0, headings: [] };
      c.w = Math.max(c.w, t.weight);
      if (heading != null && !c.headings.some((h) => axial(h, heading) < PINCH_DEG)) c.headings.push(heading);
      cells.set(i, c);
    });
  }
  return [...cells.entries()].map(([i, c]) => {
    const saddle = isSaddle(grid, i);
    const meet = Math.max(1, c.headings.length);
    const w = c.w * (1 + PINCH_BONUS * Math.min(2, meet - 1)) * (saddle ? SADDLE_BONUS : 1);
    return { p: c.p, w, meet, saddle };
  });
}

/** Difference between two line headings, 0-90. */
function axial(a: number, b: number): number {
  const d = Math.abs(a - b) % 180;
  return Math.min(d, 180 - d);
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
