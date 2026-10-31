import { describe, expect, it } from 'vitest';
import { cellCenter, yardsBetween, stepYards, bearingBetween, angleDiff, type LngLat } from '../geo';
import type { Bed, Trail } from '../movement';
import { topSitSpots } from '../sitSpots';
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
      for (const s of spots) {
        const toward = (wind + 180) % 360;
        const inCone = angleDiff(bearingBetween(s.lngLat, bed.lngLat), toward) <= 42 && yardsBetween(s.lngLat, bed.lngLat) <= 150;
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
});
