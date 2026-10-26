import { coverClass, cropClass, foodScore } from '../esau/landcover';
import type { GroundGrid } from '../esau/types';
import { cellAt, cellCenter, clamp, DEG, yardsBetween, type LngLat } from './geo';
import { analyzeTerrain, type Terrain } from './terrain';

/**
 * Where deer food probably is, inferred from overhead data and botany. Nothing here is a
 * count of acorns: it is a prediction from land cover, crops, greenness, forest type and the
 * lay of the ground, and the UI and Esau both say so.
 *
 * The botany, in short (Kentucky hardwoods):
 * - Oaks (white, chestnut, red, black) hold the dry, sunny ground: ridges, upper slopes and
 *   south and west faces. Beech, maple, basswood and tulip poplar take the moist north coves and
 *   lower slopes; sycamore, sweetgum and ash take the creek bottoms. So for the same "deciduous
 *   forest" pixel, topography says how likely the trees are oaks.
 * - Open-grown or edge oaks have big crowns and drop heavy acorn crops; thin, stressed canopy
 *   (low greenness) and young stands drop little.
 * - Hickory and beech are the second hard-mast tier, mesic ground; persimmon and apple are soft
 *   mast on old-field edges.
 * - Mast crops swing wildly year to year, tree to tree. A "likely oak flat" can have no acorns.
 */

/** USFS Forest Type Group codes (FIA). Optional input; the model works without them. */
export const FOREST_GROUP = {
  whitePine: 100,
  pine: 160,
  oakPine: 400,
  oakHickory: 500,
  oakGum: 600,
  elmAsh: 700,
  mapleBeech: 800,
  aspenBirch: 900,
} as const;

export interface VegetationGrid extends GroundGrid {
  /** NDVI x 100 per cell from overhead imagery (NAIP), 0-100. Optional. */
  greenness?: number[];
  /** FIA forest type group per cell. Optional. */
  forestType?: number[];
}

export type FoodKind = 0 | 1 | 2 | 3; // none, hard mast, crops, browse
export const FOOD_NONE = 0, FOOD_MAST = 1, FOOD_CROP = 2, FOOD_BROWSE = 3;
export const FOOD_KIND_NAME = ['none', 'acorns and other hard mast', 'crops', 'browse and forbs'];

export interface FoodStatic {
  terrain: Terrain;
  /** 0-1 likelihood the trees are oaks that bear acorns well. */
  oak: Float32Array;
  /** 0-1 hard mast (oak first, then hickory and beech). */
  mast: Float32Array;
  crop: Float32Array;
  browse: Float32Array;
  /** What the evidence rested on, for honest wording. */
  basis: string[];
}

export type FoodSeason = 'spring' | 'summer' | 'early-fall' | 'mast' | 'late' | 'winter';

export function foodSeason(date: Date): FoodSeason {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  if (m >= 3 && m <= 5) return 'spring';
  if (m >= 6 && m <= 8) return 'summer';
  if (m === 9) return 'early-fall';
  if (m === 10 || (m === 11 && d <= 15)) return 'mast';
  if (m === 11 || m === 12) return 'late';
  return 'winter';
}

/** How much each food type draws deer in a season. */
const WEIGHTS: Record<FoodSeason, { mast: number; crop: number; browse: number }> = {
  spring: { mast: 0.05, crop: 0.7, browse: 0.9 },
  summer: { mast: 0.1, crop: 1, browse: 0.8 },
  'early-fall': { mast: 0.55, crop: 0.9, browse: 0.5 },
  mast: { mast: 1, crop: 0.7, browse: 0.3 },
  late: { mast: 0.6, crop: 0.95, browse: 0.4 },
  winter: { mast: 0.3, crop: 0.8, browse: 0.7 },
};

export const SEASON_LABEL: Record<FoodSeason, string> = {
  spring: 'spring green-up',
  summer: 'summer',
  'early-fall': 'early fall',
  mast: 'acorn drop',
  late: 'late season',
  winter: 'winter',
};

const FOREST = new Set([41, 42, 43]);
const N4: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function analyzeFood(grid: VegetationGrid, terrain: Terrain = analyzeTerrain(grid)): FoodStatic {
  const { cols, rows } = grid;
  const n = cols * rows;
  const oak = new Float32Array(n);
  const mast = new Float32Array(n);
  const crop = new Float32Array(n);
  const browse = new Float32Array(n);
  const basis = ['land cover (NLCD)', 'topography'];
  if (grid.crop?.some((c) => c)) basis.push('crop map (CDL)');
  if (grid.greenness?.length === n) basis.push('overhead greenness (NDVI)');
  if (grid.forestType?.length === n) basis.push('forest type groups (USFS)');

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const code = grid.cover[i] ?? 0;
      const cc = coverClass(code);
      crop[i] = foodScore(code, grid.crop[i] ?? 0);

      // Edge: any 4-neighbour that is open ground (or forest, for open cells).
      let edge = false;
      for (const [dr, dc] of N4) {
        const rr = r + dr, c2 = c + dc;
        if (rr < 0 || c2 < 0 || rr >= rows || c2 >= cols) continue;
        const o = coverClass(grid.cover[rr * cols + c2] ?? 0);
        if (cc.woody !== o.woody && (o.open || cc.open)) edge = true;
      }

      const ndvi = grid.greenness?.length === n ? grid.greenness[i]! / 100 : null;
      const type = grid.forestType?.length === n ? grid.forestType[i]! : 0;

      if (FOREST.has(code) || code === 90) {
        const aspect = terrain.aspectDeg[i]!;
        // +1 on SW faces (dry, sunny), -1 on NE faces (moist coves).
        const dry = Number.isFinite(aspect) ? Math.cos((aspect - 225) * DEG) : 0;
        const pos = terrain.position[i]!;
        const slope = terrain.slopeDeg[i]!;
        const bottom = terrain.drainage[i]! > 0.55 || pos < -0.5;

        let o = code === 41 ? 0.5 : code === 43 ? 0.42 : code === 42 ? 0.08 : 0.12;
        o += 0.22 * pos + 0.2 * dry;
        if (slope > 32) o -= 0.15;
        if (bottom) o -= 0.3;
        if (type) {
          if (type === FOREST_GROUP.oakHickory) o = 0.55 + 0.45 * o;
          else if (type === FOREST_GROUP.oakPine || type === FOREST_GROUP.oakGum) o = 0.3 + 0.5 * o;
          else if (type === FOREST_GROUP.mapleBeech || type === FOREST_GROUP.elmAsh || type === FOREST_GROUP.aspenBirch) o *= 0.3;
          else if (type === FOREST_GROUP.pine || type === FOREST_GROUP.whitePine) o *= 0.1;
        }
        // Mature, full canopy bears; thin or stressed canopy and young stands do not.
        let vigor = 0.55 + 0.45 * cc.canopy;
        if (ndvi !== null) vigor *= ndvi < 0.45 ? 0.6 : ndvi < 0.6 ? 0.85 : 1;
        // Big open-grown crowns on an edge drop the heaviest crops.
        if (edge) vigor *= 1.15;
        oak[i] = clamp(o, 0, 1);
        const oakMast = oak[i]! * clamp(vigor, 0, 1);

        // Hickory and beech: the mesic second tier.
        const mesic = Number.isFinite(aspect) ? Math.cos((aspect - 45) * DEG) : 0;
        let nut = code === 41 || code === 43 ? 0.3 + 0.25 * mesic + (bottom ? 0 : 0.1) : 0.05;
        if (type === FOREST_GROUP.mapleBeech) nut += 0.2;
        if (type === FOREST_GROUP.pine || type === FOREST_GROUP.whitePine) nut = 0.03;
        mast[i] = clamp(Math.max(oakMast, 0.7 * nut * clamp(vigor, 0, 1)), 0, 1);

        // Browse in forest: gaps, young stands, edges.
        let b = edge ? 0.45 : 0.12;
        if (ndvi !== null && ndvi < 0.5) b += 0.15;
        if (cc.canopy < 0.5) b += 0.2;
        browse[i] = clamp(b, 0, 0.7);
      } else if (code === 52) {
        // Shrub and young growth: the best browse; old-field shrubs also carry soft mast.
        browse[i] = edge ? 0.9 : 0.75;
        mast[i] = 0.12;
      } else if (code === 71 || code === 81 || code === 82 || code === 21) {
        browse[i] = code === 71 ? 0.4 : code === 21 ? 0.15 : 0.3;
        if (edge) mast[i] = 0.1; // fencerow persimmon, apple, oak
      } else if (code === 95) browse[i] = 0.25;
    }
  }
  return { terrain, oak, mast, crop, browse, basis };
}

export interface FoodNow {
  /** 0-1 draw this season. */
  value: Float32Array;
  /** FOOD_* of whichever type drives each cell. */
  kind: Uint8Array;
  season: FoodSeason;
}

export function foodForSeason(f: FoodStatic, season: FoodSeason): FoodNow {
  const w = WEIGHTS[season];
  const n = f.mast.length;
  const value = new Float32Array(n);
  const kind = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const m = f.mast[i]! * w.mast, c = f.crop[i]! * w.crop, b = f.browse[i]! * w.browse;
    const top = Math.max(m, c, b);
    value[i] = top;
    kind[i] = top < 0.2 ? FOOD_NONE : top === c ? FOOD_CROP : top === m ? FOOD_MAST : FOOD_BROWSE;
  }
  return { value, kind, season };
}

const cache = new WeakMap<GroundGrid, FoodStatic>();
export function foodForGrid(grid: VegetationGrid): FoodStatic {
  let f = cache.get(grid);
  if (!f) cache.set(grid, (f = analyzeFood(grid)));
  return f;
}

export interface FoodRead {
  season: FoodSeason;
  here: { mastPct: number; cropName: string | null; oakLikely: boolean; kind: string };
  nearestMast: { yards: number; bearingDeg: number; what: string } | null;
  basis: string[];
  lines: string[];
}

const bearing = ([lng1, lat1]: LngLat, [lng2, lat2]: LngLat) => {
  const y = Math.sin((lng2 - lng1) * DEG) * Math.cos(lat2 * DEG);
  const x = Math.cos(lat1 * DEG) * Math.sin(lat2 * DEG) - Math.sin(lat1 * DEG) * Math.cos(lat2 * DEG) * Math.cos((lng2 - lng1) * DEG);
  return (Math.atan2(y, x) / DEG + 360) % 360;
};
const COMPASS = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];

/** What the model predicts for food at a tapped spot. Honest about being a prediction. */
export function readFood(grid: VegetationGrid, spot: LngLat, date: Date): FoodRead | null {
  const i = cellAt(grid, spot);
  if (i == null) return null;
  const f = foodForGrid(grid);
  const season = foodSeason(date);
  const now = foodForSeason(f, season);
  const crop = cropClass(grid.crop[i] ?? 0);
  const oakLikely = f.oak[i]! >= 0.55 && f.mast[i]! >= 0.4;

  let best: { i: number; d: number } | null = null;
  for (let j = 0; j < f.mast.length; j++) {
    if (f.mast[j]! < 0.5 || f.oak[j]! < 0.5) continue;
    const d = yardsBetween(spot, cellCenter(grid, j));
    if (!best || d < best.d) best = { i: j, d };
  }
  const nearestMast = best
    ? {
        yards: Math.round(best.d),
        bearingDeg: Math.round(bearing(spot, cellCenter(grid, best.i))),
        what: 'likely oak ground',
      }
    : null;

  const lines = [
    `FOOD (PREDICTED from ${f.basis.join(', ')}; not a count of acorns. Say it is a prediction, never promise acorns.)`,
    `Season for food: ${SEASON_LABEL[season]}. At this spot: ${FOOD_KIND_NAME[now.kind[i]!]} ${now.kind[i] ? `(${Math.round(now.value[i]! * 100)}%)` : ''}${crop ? `, crop: ${crop.name}` : ''}${oakLikely ? '; trees here are likely oaks (dry, sunny ground, mature canopy)' : ''}.`.replace(/ \)/g, ')'),
  ];
  if (nearestMast)
    lines.push(
      `Nearest likely oak mast: about ${nearestMast.yards} yd ${COMPASS[Math.round(nearestMast.bearingDeg / 45) % 8]}.`,
    );
  else lines.push('No likely oak ground inside this map.');
  lines.push('Acorn crops fail in some years and vary tree to tree; fresh cut shells and cleaned-out leaf litter tell the truth.');
  return {
    season,
    here: { mastPct: Math.round(f.mast[i]! * 100), cropName: crop?.name ?? null, oakLikely, kind: FOOD_KIND_NAME[now.kind[i]!]! },
    nearestMast,
    basis: f.basis,
    lines,
  };
}
