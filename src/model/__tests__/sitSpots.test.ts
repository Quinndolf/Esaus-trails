import { describe, expect, it } from 'vitest';
import { cellCenter, yardsBetween, stepYards, bearingBetween, angleDiff, insideBounds, type LngLat } from '../geo';
import type { Bed, Trail } from '../movement';
import { SCENT_CONE_DEG, sitVerdict, STAY_AT_PCT, topSitSpots, UNSURE_BELOW, WALK_YD } from '../sitSpots';
import { BOX, makeGrid } from './fixtures';

const grid = makeGrid(() => 250);
const mid = (r: number, c: number): LngLat => cellCenter(grid, r * BOX.cols + c);

/** A trail running west to east across the middle row. */
const trail: Trail = { coordinates: Array.from({ length: 24 }, (_, k) => mid(16, 4 + k)), weight: 1 };
const run = (o: Partial<Parameters<typeof topSitSpots>[0]> = {}) =>
  topSitSpots({ grid, trails: [trail], beds: [], windFromDeg: () => 0, weapon: 'bow', ...o });

describe('top sit spots', () => {
  it('sits downwind of the trail, so it flips side when the wind flips', () => {
    const north = run({ windFromDeg: () => 0 }).spots[0]!;
    const south = run({ windFromDeg: () => 180 }).spots[0]!;
    const trailLat = trail.coordinates[0]![1];
    // A north wind carries your scent south, so sit south of the trail and it goes away from the deer.
    expect(north.lngLat[1]).toBeLessThan(trailLat);
    expect(south.lngLat[1]).toBeGreaterThan(trailLat);
  });

  it('never leaves a bed in the hunter\'s downwind cone', () => {
    const bed: Bed = { lngLat: stepYards(mid(16, 16), 0, 130), score: 0.8, elevationFt: 800 };
    for (const wind of [0, 90, 180, 270]) {
      const { spots } = run({ beds: [bed], windFromDeg: () => wind });
      expect(spots.length).toBeGreaterThan(0);
      for (const s of spots) {
        const toward = (wind + 180) % 360;
        const inCone = angleDiff(bearingBetween(s.lngLat, bed.lngLat), toward) <= SCENT_CONE_DEG && yardsBetween(s.lngLat, bed.lngLat) <= 150;
        expect(inCone).toBe(false);
      }
    }
  });

  it('spaces the picks at least 100 yd apart and ranks them', () => {
    const { spots } = run();
    expect(spots.length).toBeGreaterThan(1);
    spots.forEach((s, k) => expect(s.rank).toBe(k + 1));
    for (let a = 0; a < spots.length; a++)
      for (let b = a + 1; b < spots.length; b++) expect(yardsBetween(spots[a]!.lngLat, spots[b]!.lngLat)).toBeGreaterThanOrEqual(100);
  });

  it('sits closer to the trail with a bow than with a rifle', () => {
    const d = (w: 'bow' | 'rifle') => {
      const s = run({ weapon: w }).spots[0]!;
      return Math.min(...trail.coordinates.map((p) => yardsBetween(s.lngLat, p)));
    };
    expect(d('bow')).toBeLessThan(d('rifle'));
  });

  it('says it is not sure when the ground has no trails', () => {
    const r = topSitSpots({ grid, trails: [], beds: [], windFromDeg: () => 0, weapon: 'bow' });
    expect(r.spots).toEqual([]);
    expect(r.unsure).toBe(true);
  });

  it('tells which way to watch: toward the trail', () => {
    const s = run().spots[0]!;
    const toTrail = Math.min(...trail.coordinates.map((p) => angleDiff(bearingBetween(s.lngLat, p), s.watchBearingDeg)));
    expect(toTrail).toBeLessThan(25);
    expect(s.reason.length).toBeGreaterThan(10);
  });

  it('says it is not sure when the only traffic is faint', () => {
    const faint: Trail = { ...trail, weight: 0.05 };
    const r = topSitSpots({ grid, trails: [faint], beds: [], windFromDeg: () => 0, weapon: 'bow' });
    expect(r.spots.length).toBeGreaterThan(0);
    expect(r.unsure).toBe(true);
    expect(run().unsure).toBe(false);
    expect(UNSURE_BELOW).toBeGreaterThan(0);
  });

  it('honors max, including zero', () => {
    expect(run({ max: 1 }).spots).toHaveLength(1);
    expect(run({ max: 0 }).spots).toEqual([]);
  });

  it('prefers a seat beside the trail to one in line with it', () => {
    const s = run().spots[0]!;
    const nearest = trail.coordinates.reduce((m, p) => (yardsBetween(s.lngLat, p) < yardsBetween(s.lngLat, m) ? p : m));
    const off = bearingBetween(nearest, s.lngLat);
    const alongTrail = Math.min(angleDiff(off, 90), angleDiff(off, 270));
    expect(alongTrail).toBeGreaterThan(30); // trail runs east-west
  });

  it('marks down an approach that blows scent over a bed', () => {
    const bed: Bed = { lngLat: stepYards(mid(16, 16), 90, 400), score: 0.8, elevationFt: 800 };
    const base = run({ beds: [bed], windFromDeg: () => 270 });
    const withWalk = run({ beds: [bed], windFromDeg: () => 270, hunter: stepYards(bed.lngLat, 270, 100) });
    expect(withWalk.spots[0]!.score).toBeLessThanOrEqual(base.spots[0]!.score);
  });

  it('keeps every bearing under 360', () => {
    for (const s of run().spots) expect(s.watchBearingDeg).toBeLessThan(360);
  });
});

describe('pinch points', () => {
  // A second trail running north to south, crossing the first at column 16.
  const cross: Trail = { coordinates: Array.from({ length: 24 }, (_, k) => mid(4 + k, 16)), weight: 1 };

  it('favors watching where trails meet, and says so', () => {
    const { spots } = topSitSpots({ grid, trails: [trail, cross], beds: [], windFromDeg: () => 45, weapon: 'bow' });
    const best = spots[0]!;
    const meet = mid(16, 16);
    expect(yardsBetween(best.lngLat, meet)).toBeLessThan(80);
    expect(best.reason).toMatch(/Pinch point: 2 predicted trails meet/);
  });

  it('calls out a trail crossing a saddle', () => {
    // A ridge running east-west with a dip at column 16: the trail crosses the ridge through the low spot.
    const ridge = {
      ...makeGrid(() => 0),
      elevationM: Array.from({ length: BOX.rows * BOX.cols }, (_, i) => {
        const r = Math.floor(i / BOX.cols), c = i % BOX.cols;
        return 250 - Math.abs(r - 16) * 15 - (c === 16 ? 10 : 0);
      }),
    };
    const midR = (r: number, c: number): LngLat => cellCenter(ridge, r * BOX.cols + c);
    const over: Trail = { coordinates: Array.from({ length: 24 }, (_, k) => midR(4 + k, 16)), weight: 1 };
    const { spots } = topSitSpots({ grid: ridge, trails: [over], beds: [], windFromDeg: () => 90, weapon: 'bow' });
    expect(spots.some((s) => /saddle/.test(s.reason))).toBe(true);
  });
});

describe('pinch points are real junctions', () => {
  it('two trails sharing one stretch are not a pinch, and the shared stretch is not counted twice', () => {
    const a: Trail = { coordinates: Array.from({ length: 24 }, (_, k) => mid(16, 4 + k)), weight: 1 };
    const b: Trail = { coordinates: Array.from({ length: 24 }, (_, k) => mid(16, 4 + k)), weight: 1 };
    const one = topSitSpots({ grid, trails: [a], beds: [], windFromDeg: () => 0, weapon: 'bow' });
    const two = topSitSpots({ grid, trails: [a, b], beds: [], windFromDeg: () => 0, weapon: 'bow' });
    expect(two.spots.map((s) => s.reason)).toEqual(one.spots.map((s) => s.reason));
    expect(two.spots.every((s) => !/Pinch/.test(s.reason))).toBe(true);
  });

  it('only picks inside the screen box, but says unsure only from what is on screen', () => {
    const within = { west: mid(16, 20)[0], east: BOX.east, south: BOX.south, north: BOX.north };
    const r = topSitSpots({ grid, trails: [trail], beds: [], windFromDeg: () => 0, weapon: 'bow', within });
    expect(r.spots.length).toBeGreaterThan(0);
    for (const s of r.spots) expect(s.lngLat[0]).toBeGreaterThanOrEqual(within.west);
    expect(r.spots[0]!.score).toBe(1);
  });
});

describe('stay or move verdict', () => {
  const boxOf = (r0: number, r1: number, c0: number, c1: number) => {
    const [w, n] = mid(r0, c0), [e, s] = mid(r1, c1);
    return { west: w, east: e, north: n, south: s };
  };

  it('says stay, near 100%, on the top pick itself', () => {
    const best = run().spots[0]!;
    const v = sitVerdict({ grid, trails: [trail], beds: [], windFromDeg: () => 0, weapon: 'bow' }, best.lngLat)!;
    expect(v.pct).toBeGreaterThanOrEqual(99);
    expect(v.stay).toBe(true);
  });

  it('says move, with better spots, when your scent blows onto the trail', () => {
    // A south wind carries scent north; sitting just south of the trail puts it right on the deer.
    const at = stepYards(mid(16, 16), 180, 20);
    const v = sitVerdict({ grid, trails: [trail], beds: [], windFromDeg: () => 180, weapon: 'bow' }, at)!;
    expect(v.pct).toBeLessThan(STAY_AT_PCT);
    expect(v.stay).toBe(false);
    expect(v.better.length).toBeGreaterThan(0);
    expect(v.better[0]!.lngLat[1]).toBeGreaterThan(trail.coordinates[0]![1]); // the better sit is on the north side
  });

  it('keeps better spots on screen, and names a walkable one just off it', () => {
    const view = boxOf(21, 30, 4, 27); // south of the trail; the trail itself is off screen
    const at = mid(24, 16); // ~360 yd south of the trail
    const v = sitVerdict({ grid, trails: [trail], beds: [], windFromDeg: () => 0, weapon: 'bow', within: view }, at)!;
    expect(v.stay).toBe(false);
    for (const b of v.better) expect(insideBounds(view, b.lngLat)).toBe(true);
    expect(v.offScreen).toBeDefined();
    expect(insideBounds(view, v.offScreen!.lngLat)).toBe(false);
    expect(yardsBetween(at, v.offScreen!.lngLat)).toBeLessThanOrEqual(WALK_YD);
  });

  it('names nothing off screen past walking distance', () => {
    const v = sitVerdict({ grid, trails: [trail], beds: [], windFromDeg: () => 0, weapon: 'bow', within: boxOf(30, 31, 4, 27) }, mid(31, 16));
    // ~620 yd south of the trail with a 400 yd walk: nothing to walk to.
    const near = sitVerdict({ grid, trails: [trail], beds: [], windFromDeg: () => 0, weapon: 'bow', within: boxOf(30, 31, 4, 27) }, mid(31, 16), { walkYd: 400 });
    expect(v?.offScreen).toBeDefined();
    expect(near?.offScreen).toBeUndefined();
  });

  it('returns null with no trails to judge against', () => {
    expect(sitVerdict({ grid, trails: [], beds: [], windFromDeg: () => 0, weapon: 'bow' }, mid(16, 16))).toBeNull();
  });
});
