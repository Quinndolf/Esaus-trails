import { describe, expect, it } from 'vitest';
import { yardsBetween } from '../geo';
import { sunTimes } from '../sun';
import { squirrelActivity, squirrelSitSpots, SQUIRREL_UNSURE_BELOW } from '../squirrelSpots';
import { BOX, CENTER, makeGrid } from './fixtures';

const n = BOX.cols * BOX.rows;
const noon = new Date('2026-11-05T18:00:00Z');
/** Left half gets `left`, right half gets `right` (NLCD codes). */
const split = (left: number, right: number) => Array.from({ length: n }, (_, i) => (i % BOX.cols < BOX.cols / 2 ? left : right));
const ground = (cover: number[], forestType?: number[]) => ({ ...makeGrid(() => 250), cover, forestType });
const midMorning = (() => {
  const s = sunTimes(noon, CENTER[1], CENTER[0]).sunrise!;
  return new Date(s.getTime() + 60 * 60e3);
})();
const run = (g: ReturnType<typeof ground>, o: Partial<Parameters<typeof squirrelSitSpots>[0]> = {}) =>
  squirrelSitSpots({ grid: g, cover: g.cover, forestType: g.forestType, at: midMorning, weapon: 'pellet', ...o });

describe('squirrel activity', () => {
  it('is high in the first hours of daylight and late afternoon, and low at midday and at night', () => {
    const t = sunTimes(noon, CENTER[1], CENTER[0]);
    const at = (d: Date, h: number) => squirrelActivity(new Date(d.getTime() + h * 3600e3), CENTER[1], CENTER[0]);
    const morning = at(t.sunrise!, 1);
    const evening = at(t.sunset!, -1.5);
    const midday = at(t.solarNoon, 0);
    const night = at(t.sunset!, 3);
    expect(morning).toBeGreaterThan(0.8);
    expect(evening).toBeGreaterThan(0.7);
    expect(midday).toBeLessThan(morning);
    expect(night).toBeLessThan(0.1);
  });
});

describe('squirrel food-tree stands', () => {
  it('sits in hardwood, not evergreen', () => {
    const { spots } = run(ground(split(42, 41)));
    expect(spots.length).toBeGreaterThan(0);
    const midLng = (BOX.west + BOX.east) / 2;
    for (const s of spots) expect(s.lngLat[0]).toBeGreaterThan(midLng);
  });

  it('prefers oak-hickory ground when the forest type is known, and works without it', () => {
    const cover = split(41, 41);
    const ft = split(100, 500); // west pine, east oak-hickory
    const { spots } = run(ground(cover, ft));
    expect(spots[0]!.lngLat[0]).toBeGreaterThan((BOX.west + BOX.east) / 2);
    expect(run(ground(cover)).spots.length).toBeGreaterThan(0);
  });

  it('gives no spots, and says unsure, when there is no hardwood', () => {
    const r = run(ground(split(81, 82)));
    expect(r.spots).toEqual([]);
    expect(r.unsure).toBe(true);
  });

  it('returns up to three spread-out spots in the same shape as deer spots, with squirrel wording', () => {
    const r = run(ground(split(41, 41)));
    expect(r.spots.length).toBe(3);
    expect(r.spots.map((s) => s.rank)).toEqual([1, 2, 3]);
    for (const s of r.spots) {
      expect(s.kind).toBe('food_trees');
      expect(s.score).toBeGreaterThan(0);
      expect(s.score).toBeLessThanOrEqual(1);
      expect(s.reason).not.toMatch(/wind|scent|trail/i);
    }
    for (let a = 0; a < 3; a++) for (let b = a + 1; b < 3; b++) expect(yardsBetween(r.spots[a]!.lngLat, r.spots[b]!.lngLat)).toBeGreaterThanOrEqual(100);
  });

  it('is unsure at midday on ordinary hardwood, because squirrels are not moving', () => {
    const g = ground(split(41, 41));
    const noonRead = run(g, { at: sunTimes(noon, CENTER[1], CENTER[0]).solarNoon });
    expect(run(g).unsure).toBe(false);
    expect(noonRead.unsure).toBe(true);
    expect(SQUIRREL_UNSURE_BELOW).toBeGreaterThan(0);
  });

  it('honors max and returns nothing when max is zero', () => {
    expect(run(ground(split(41, 41)), { max: 1 }).spots.length).toBe(1);
    expect(run(ground(split(41, 41)), { max: 0 }).spots).toEqual([]);
  });
});
