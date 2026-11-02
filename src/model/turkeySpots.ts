import { bearingBetween, cardinal, cellCenter, clamp, yardsBetween, type LngLat } from './geo';
import { WEAPON_RANGE_YD, type SitSpot, type Weapon } from './sitSpots';
import { sunTimes } from './sun';
import { analyzeTerrain } from './terrain';
import type { ElevationGrid } from './types';

/**
 * Where to set up for turkeys. A turkey is all eyes and ears, so this model ignores scent and wind.
 * Two kinds of spot, by the hour:
 *  - Roost ridge (dark to about 30 minutes after sunrise): tall timber on a ridge, bench or upper
 *    slope with an opening close by to fly down to. The hunter slips in under darkness and stays back.
 *  - Strut zone (after fly-down to dusk): open flats, field edges and pasture with woods beside them.
 * Spring (Mar-May) favors late morning, when hens leave for their nests and lonely gobblers answer.
 * Fall birds are in flocks and feed morning and afternoon.
 * Sources: Dickson 1992, The Wild Turkey: Biology and Management; KDFWR turkey pages
 * (https://fw.ky.gov/Hunt/Pages/TurkeyHunt.aspx). It is a prediction from ground and hour, never a
 * claim that a bird is there. It cannot see tree size, water, fresh sign or other hunters.
 */

export const TURKEY_UNSURE_BELOW = 0.35;

/** NLCD classes. Timber for roosting; open ground for strutting and feeding. */
const TIMBER: Record<number, number> = { 41: 1, 43: 0.9, 42: 0.4, 90: 0.5 };
const OPEN: Record<number, number> = { 81: 1, 71: 0.9, 82: 0.7, 52: 0.4 };
/** Oak-hickory feeds birds (acorns); pine-only ground is a poor roost and feed. */
const FOREST_TYPE: Record<number, number> = { 500: 1.1, 800: 0.95, 400: 0.85, 900: 0.75, 700: 0.6, 100: 0.5, 200: 0.5, 300: 0.5 };

export type TurkeyPhase = 'roost' | 'strut' | 'dark';
export type TurkeySeason = 'spring' | 'fall' | 'off';

export function turkeySeason(date: Date): TurkeySeason {
  const m = date.getUTCMonth() + 1;
  return m >= 3 && m <= 5 ? 'spring' : m >= 9 && m <= 12 ? 'fall' : 'off';
}

/** What the birds are doing: on the roost (dark to 30 min after sunrise), up and about, or asleep again. */
export function turkeyPhase(date: Date, lat: number, lng: number): TurkeyPhase {
  const t = sunTimes(date, lat, lng);
  if (!t.sunrise || !t.sunset) return 'strut';
  const h = 3600e3;
  const fromRise = (date.getTime() - t.sunrise.getTime()) / h;
  const fromSet = (date.getTime() - t.sunset.getTime()) / h;
  if (fromSet > 0.5 || fromRise < -1.5) return 'dark';
  if (fromRise < 0.5) return 'roost';
  return 'strut';
}

/** 0-1 how likely a bird is to be where the model puts the spot, for the hour and season. */
export function turkeyActivity(date: Date, lat: number, lng: number): number {
  const phase = turkeyPhase(date, lat, lng);
  if (phase === 'dark') return 0.1;
  const t = sunTimes(date, lat, lng);
  if (!t.sunrise || !t.sunset) return 0.5;
  const fromRise = (date.getTime() - t.sunrise.getTime()) / 3600e3;
  const fromSet = (date.getTime() - t.sunset.getTime()) / 3600e3;
  if (phase === 'roost') return 1;
  const season = turkeySeason(date);
  if (fromRise <= 3) return 0.9; // fly-down and the first strut
  if (fromRise <= 5) return season === 'spring' ? 1 : 0.7; // spring: hens leave for nests, gobblers get lonely
  if (fromSet >= -2.5) return 0.7; // afternoon feeding, working back toward roost
  return season === 'spring' ? 0.5 : 0.3; // midday loaf
}

export interface TurkeySpotInput {
  grid: ElevationGrid;
  /** NLCD class code per cell. */
  cover: ArrayLike<number>;
  forestType?: ArrayLike<number>;
  at: Date;
  weapon: Weapon;
  max?: number;
}

export interface TurkeySpotResult {
  spots: SitSpot[];
  unsure: boolean;
  activity: number;
  phase: TurkeyPhase;
  season: TurkeySeason;
}

/** Mean of `value` over cells within `rad` cells, excluding none. */
function nearby(value: ArrayLike<number>, cols: number, rows: number, rad: number): Float32Array {
  const out = new Float32Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let sum = 0;
      let k = 0;
      for (let dr = -rad; dr <= rad; dr++) {
        for (let dc = -rad; dc <= rad; dc++) {
          sum += value[clamp(r + dr, 0, rows - 1) * cols + clamp(c + dc, 0, cols - 1)]!;
          k++;
        }
      }
      out[r * cols + c] = sum / k;
    }
  }
  return out;
}

export function turkeySitSpots(input: TurkeySpotInput): TurkeySpotResult {
  const { grid, cover, forestType, weapon } = input;
  const { cols, rows } = grid;
  const n = cols * rows;
  const limit = Math.max(0, Math.floor(input.max ?? 3));
  const lat = (grid.north + grid.south) / 2;
  const lng = (grid.east + grid.west) / 2;
  const phase = turkeyPhase(input.at, lat, lng);
  const season = turkeySeason(input.at);
  const activity = turkeyActivity(input.at, lat, lng);
  const none: TurkeySpotResult = { spots: [], unsure: true, activity, phase, season };
  if (!limit || cover.length !== n || phase === 'dark') return none;

  const timber = new Float32Array(n);
  const open = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const code = cover[i] ?? 0;
    const ft = forestType?.[i] || undefined;
    timber[i] = (TIMBER[code] ?? 0) * (ft ? (FOREST_TYPE[ft] ?? 0.7) : 1);
    open[i] = OPEN[code] ?? 0;
  }
  const timberNear = nearby(timber, cols, rows, 1);
  const openNear = nearby(open, cols, rows, 3); // about 130 yd
  const timberWide = nearby(timber, cols, rows, 3);
  const terrain = analyzeTerrain(grid);

  const score = new Float32Array(n);
  let top = 0;
  for (let i = 0; i < n; i++) {
    const high = clamp((terrain.position[i]! + 0.3) / 0.9, 0, 1); // ridge, bench, upper slope
    const gentle = 1 - clamp((terrain.slopeDeg[i]! - 6) / 20, 0, 1);
    if (phase === 'roost') {
      // Roost ridge: timber under foot and around, up high, with an opening close to fly down to.
      score[i] = timber[i]! > 0 ? Math.min(timberNear[i]!, 1) * (0.4 + 0.6 * high) * (0.5 + 0.5 * clamp(openNear[i]! * 3, 0, 1)) : 0;
    } else {
      // Strut zone: open, gentle ground with woods beside it. A field with no timber nearby scores lower.
      score[i] = open[i]! > 0 ? open[i]! * (0.4 + 0.6 * gentle) * (0.5 + 0.5 * clamp(timberWide[i]! * 2.5, 0, 1)) : 0;
    }
    if (score[i]! > top) top = score[i]!;
  }
  if (top < 0.05) return none;

  const minSpacing = phase === 'roost' ? 150 : 120;
  const order = Array.from({ length: n }, (_, i) => i)
    .filter((i) => score[i]! >= 0.05)
    .sort((a, b) => score[b]! - score[a]! || a - b);
  const picked: number[] = [];
  for (const i of order) {
    const at = cellCenter(grid, i);
    if (picked.some((p) => yardsBetween(cellCenter(grid, p), at) < minSpacing)) continue;
    picked.push(i);
    if (picked.length >= limit) break;
  }

  /** The nearest cell of the other kind (an opening from a roost; the woods from a strut zone). */
  const nearestOf = (i: number, want: Float32Array) => {
    let best = -1;
    let bestYd = Infinity;
    const here = cellCenter(grid, i);
    for (let j = 0; j < n; j++) {
      if (want[j]! < 0.5) continue;
      const yd = yardsBetween(here, cellCenter(grid, j));
      if (yd < bestYd) {
        bestYd = yd;
        best = j;
      }
    }
    return best < 0 ? null : { at: cellCenter(grid, best), yd: bestYd };
  };

  const reach = WEAPON_RANGE_YD[weapon].max;
  const timing =
    phase === 'roost'
      ? 'birds are still on the limb'
      : activity >= 0.9
        ? season === 'spring'
          ? 'prime time, when hens leave for their nests'
          : 'birds are up and feeding'
        : activity >= 0.6
          ? 'birds are feeding'
          : 'birds are loafing and slow now';
  const spots = picked.map((i, k): SitSpot => {
    const at = cellCenter(grid, i);
    const other = nearestOf(i, phase === 'roost' ? open : timber);
    const watch = other && other.yd > 0 ? bearingBetween(at, other.at) : 0;
    const where = other ? `facing ${cardinal(watch)} toward the ${phase === 'roost' ? 'opening they fly down to' : 'woods they come out of'}` : '';
    const reason =
      phase === 'roost'
        ? `Likely roost ridge: tall timber up high with an opening nearby, ${timing}. Slip in before light, stay 100 to 200 yd back and ${where || 'face the open side'}. Do not walk up under the roost.`
        : `Likely strut zone: open ground beside woods, ${timing}. Sit against a wide tree in shade, ${where || 'facing the open ground'}, and stay still. Birds see movement from far off; shots inside ${reach} yd.`;
    return {
      rank: k + 1,
      lngLat: at as LngLat,
      watchBearingDeg: Math.round(watch) % 360,
      score: score[i]! / top,
      yardsToTrail: Math.round(other?.yd ?? 0),
      kind: phase === 'roost' ? 'roost' : 'strut_zone',
      reason,
    };
  });
  return { spots, unsure: top * activity < TURKEY_UNSURE_BELOW, activity, phase, season };
}
