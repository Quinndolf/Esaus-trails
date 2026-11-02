import { bearingBetween, cardinal, cellCenter, clamp, yardsBetween, type LngLat } from './geo';
import { WEAPON_RANGE_YD, type SitSpot, type Weapon } from './sitSpots';
import { sunTimes } from './sun';
import { analyzeTerrain } from './terrain';
import type { ElevationGrid } from './types';

/**
 * Where to sit for squirrels: food-tree stands, not trails. Kentucky Fish and Wildlife says squirrels
 * live where there is hardwood (hickory, beech, pecan, black walnut, white oak), are most active in the
 * first hours of daylight and late afternoon, and detect movement and noise, so a still hunter wins.
 * Source: https://fw.ky.gov/Hunt/Pages/Squirrel.aspx
 *
 * What it can see: NLCD land cover and, when the grid has it, the USFS forest type group (500 =
 * oak-hickory). What it cannot see: which trees are nut trees, or fresh cuttings on the ground.
 * It is a prediction about ground and hour, never a claim that a squirrel is there. Scent is ignored:
 * wind matters far less for squirrels than for deer.
 */

/** Best stand times the hour's activity; below this the read is "not sure". */
export const SQUIRREL_UNSURE_BELOW = 0.4;

const MIN_SPACING_YD = 100;
/** NLCD cover: how much of a stand's value this cell holds. */
const COVER: Record<number, number> = { 41: 1, 43: 0.85, 90: 0.5, 52: 0.2, 42: 0.15 };
/** USFS forest type groups. Beech is in 800; hickory and white oak are in 500. */
const FOREST_TYPE: Record<number, number> = { 500: 1.1, 800: 0.95, 400: 0.8, 900: 0.7, 700: 0.6, 100: 0.15, 200: 0.15, 300: 0.15 };

/**
 * 0-1 how active squirrels are at `date`: peak from first light to about 2.5 hours later, a second
 * peak for the last 1.5 hours before sunset, a lull at midday, nearly nothing after dark.
 */
export function squirrelActivity(date: Date, lat: number, lng: number): number {
  const t = sunTimes(date, lat, lng);
  if (!t.sunrise || !t.sunset) return 0.25;
  const h = 3600e3;
  const fromRise = (date.getTime() - t.sunrise.getTime()) / h;
  const fromSet = (date.getTime() - t.sunset.getTime()) / h;
  if (fromRise < -0.5 || fromSet > 0.5) return 0.05; // dark
  const ramp = (x: number, x0: number, x1: number, y0: number, y1: number) => y0 + (y1 - y0) * clamp((x - x0) / (x1 - x0), 0, 1);
  let a = 0.25; // daylight lull
  if (fromRise < 0) a = Math.max(a, ramp(fromRise, -0.5, 0, 0.6, 1));
  else if (fromRise <= 2.5) a = 1;
  else a = Math.max(a, ramp(fromRise, 2.5, 5, 1, 0.25));
  if (fromSet > 0) a = Math.max(a, ramp(fromSet, 0, 0.5, 1, 0.05));
  else if (fromSet >= -1.5) a = 1;
  else a = Math.max(a, ramp(fromSet, -4, -1.5, 0.25, 1));
  return clamp(a, 0, 1);
}

export interface SquirrelSpotInput {
  grid: ElevationGrid;
  /** NLCD class code per cell. */
  cover: ArrayLike<number>;
  /** USFS forest type group per cell, 0 or absent when unknown. */
  forestType?: ArrayLike<number>;
  at: Date;
  weapon: Weapon;
  max?: number;
}

export interface SquirrelSpotResult {
  spots: SitSpot[];
  unsure: boolean;
  /** 0-1 squirrel activity for the hour. */
  activity: number;
}

function cellValue(cover: number, forestType: number | undefined): number {
  const c = COVER[cover] ?? 0;
  if (!c || !forestType) return c; // unknown forest type is neutral
  return clamp(c * (FOREST_TYPE[forestType] ?? 0.7), 0, 1);
}

export function squirrelSitSpots(input: SquirrelSpotInput): SquirrelSpotResult {
  const { grid, cover, forestType, weapon } = input;
  const { cols, rows } = grid;
  const n = cols * rows;
  const limit = Math.max(0, Math.floor(input.max ?? 3));
  const lat = (grid.north + grid.south) / 2;
  const lng = (grid.east + grid.west) / 2;
  const activity = squirrelActivity(input.at, lat, lng);
  const none: SquirrelSpotResult = { spots: [], unsure: true, activity };
  if (!limit || cover.length !== n) return none;

  const value = new Float32Array(n);
  for (let i = 0; i < n; i++) value[i] = cellValue(cover[i] ?? 0, forestType?.[i] || undefined);
  // A stand is the neighborhood, not one cell.
  const stand = new Float32Array(n);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let sum = 0;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) sum += value[clamp(r + dr, 0, rows - 1) * cols + clamp(c + dc, 0, cols - 1)]!;
      stand[r * cols + c] = sum / 9;
    }
  }
  const terrain = analyzeTerrain(grid);
  const score = new Float32Array(n);
  let top = 0;
  for (let i = 0; i < n; i++) {
    // Bottoms and lower slopes hold cover and mast; ridge tops count a little less.
    const pos = 1 - clamp(Math.abs(terrain.position[i]! + 0.2) / 1.2, 0, 1);
    score[i] = stand[i]! * (0.7 + 0.3 * pos);
    if (score[i]! > top) top = score[i]!;
  }
  if (top < 0.05) return none;

  const order = Array.from({ length: n }, (_, i) => i)
    .filter((i) => score[i]! >= 0.05)
    .sort((a, b) => score[b]! - score[a]! || a - b);
  const picked: number[] = [];
  for (const i of order) {
    const at = cellCenter(grid, i);
    if (picked.some((p) => yardsBetween(cellCenter(grid, p), at) < MIN_SPACING_YD)) continue;
    picked.push(i);
    if (picked.length >= limit) break;
  }

  const reach = WEAPON_RANGE_YD[weapon].max;
  const spots = picked.map((i, k): SitSpot => {
    const at = cellCenter(grid, i);
    const r = Math.floor(i / cols);
    const c = i % cols;
    let best = i;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const rr = r + dr;
        const cc = c + dc;
        if (rr < 0 || rr >= rows || cc < 0 || cc >= cols) continue;
        const j = rr * cols + cc;
        if (best === i || value[j]! > value[best]!) best = j;
      }
    }
    const toward = cellCenter(grid, best);
    const watch = best === i ? 0 : bearingBetween(at, toward);
    const oak = forestType?.[i] === 500;
    const pos = terrain.position[i]!;
    const land = pos < -0.3 ? 'in a bottom or hollow' : pos > 0.3 ? 'on a bench or ridge' : 'on the slope';
    const timing = activity >= 0.8 ? 'prime squirrel hours' : activity >= 0.4 ? 'squirrels are moving some' : 'squirrels are slow now';
    return {
      rank: k + 1,
      lngLat: at as LngLat,
      watchBearingDeg: Math.round(watch) % 360,
      score: score[i]! / top,
      yardsToTrail: Math.round(best === i ? 0 : yardsBetween(at, toward)),
      kind: 'food_trees',
      reason: `${oak ? 'Oak-hickory woods' : 'Hardwood cover'} ${land}, ${timing}. Sit still and watch the trees within ${reach} yd${best === i ? '' : `, facing ${cardinal(watch)}`}.`,
    };
  });
  return { spots, unsure: top * activity < SQUIRREL_UNSURE_BELOW, activity };
}

