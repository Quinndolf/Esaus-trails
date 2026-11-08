import { describe, expect, it } from 'vitest';
import { angleDiff, bearingBetween, cellAt, cellCenter, yardsBetween, type LngLat } from '../geo';
import type { Bed } from '../movement';
import { BED_SMELL_YD, walkRoute } from '../walkRoute';
import { BOX, makeGrid } from './fixtures';

const grid = makeGrid(() => 250);
const n = BOX.cols * BOX.rows;
const mid = (r: number, c: number): LngLat => cellCenter(grid, r * BOX.cols + c);
/** Scent drifting toward `deg` everywhere, in a 60 degree cone. */
const drift = (deg: number) => ({ driftBearing: new Float32Array(n).fill(deg), spreadDeg: new Float32Array(n).fill(60) });

/** Does any point along the walk blow scent onto the bed? */
const blowsOnBed = (path: LngLat[], bed: LngLat, toward: number) => {
  for (let k = 1; k < path.length; k++) {
    const a = path[k - 1]!, b = path[k]!;
    const steps = Math.ceil(yardsBetween(a, b) / 10);
    for (let s = 0; s <= steps; s++) {
      const p: LngLat = [a[0] + ((b[0] - a[0]) * s) / steps, a[1] + ((b[1] - a[1]) * s) / steps];
      const d = yardsBetween(p, bed);
      if (d > 3 && d <= BED_SMELL_YD - 30 && angleDiff(bearingBetween(p, bed), toward) <= 25) return true;
    }
  }
  return false;
};

describe('walk-in route', () => {
  it('walks straight when nothing is downwind', () => {
    const r = walkRoute({ grid, scent: drift(0), trails: [], beds: [], from: mid(28, 4), to: mid(28, 26) })!;
    expect(r.exposedYd).toBe(0);
    expect(r.yards).toBeLessThan(yardsBetween(mid(28, 4), mid(28, 26)) * 1.05);
    expect(r.path[0]).toEqual(mid(28, 4));
    expect(r.path[r.path.length - 1]).toEqual(mid(28, 26));
  });

  it('swings downwind of a bed instead of walking past it with the wind on it', () => {
    // Scent drifts north. A bed sits just north of the straight line, so the straight walk blows on it.
    const bed: Bed = { lngLat: mid(13, 15), score: 1, elevationFt: 800 };
    const from = mid(16, 2), to = mid(16, 29);
    const r = walkRoute({ grid, scent: drift(0), trails: [], beds: [bed], from, to })!;
    expect(blowsOnBed([from, to], bed.lngLat, 0)).toBe(true);
    expect(blowsOnBed(r.path, bed.lngLat, 0)).toBe(false);
    expect(r.exposedYd).toBe(0);
    // Swinging wide costs some walking, but not a marathon.
    expect(r.yards).toBeLessThan(yardsBetween(from, to) * 2);
  });

  it('keeps scent off a trail it has to cross, crossing where the wind carries scent along, not onto, the deer', () => {
    // A trail runs north-south down column 16; scent drifts east. The walk goes west to east and must cross it.
    const trail = { coordinates: Array.from({ length: 30 }, (_, k) => mid(1 + k, 16)), weight: 1 };
    const r = walkRoute({ grid, scent: drift(90), trails: [trail], beds: [], from: mid(16, 3), to: mid(16, 29) })!;
    expect(r.path.length).toBeGreaterThanOrEqual(2);
    // East of the trail the scent drifts away from it; only the stretch west of it can foul the trail.
    expect(r.exposedYd).toBeLessThanOrEqual(150);
  });

  it('returns null off the ground', () => {
    expect(walkRoute({ grid, scent: drift(0), trails: [], beds: [], from: [BOX.east + 0.1, BOX.north], to: mid(5, 5) })).toBeNull();
  });

  it('starts and ends on the given points even inside one cell', () => {
    const a = mid(5, 5), b: LngLat = [a[0] + 0.00005, a[1]];
    expect(cellAt(grid, b)).toBe(cellAt(grid, a));
    expect(walkRoute({ grid, scent: drift(0), trails: [], beds: [], from: a, to: b })!.path).toEqual([a, b]);
  });
});
