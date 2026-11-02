import { describe, expect, it } from 'vitest';
import { sunTimes } from '../sun';
import { turkeyActivity, turkeyPhase, turkeySeason, turkeySitSpots } from '../turkeySpots';
import { BOX, CENTER, makeGrid, ridge } from './fixtures';

const n = BOX.cols * BOX.rows;
const midLng = (BOX.west + BOX.east) / 2;
const split = (left: number, right: number) => Array.from({ length: n }, (_, i) => (i % BOX.cols < BOX.cols / 2 ? left : right));
const ground = (cover: number[], forestType?: number[]) => ({ ...makeGrid(() => 250), cover, forestType });
const spring = new Date('2026-05-05T18:00:00Z');
const fall = new Date('2026-11-05T18:00:00Z');
const rel = (day: Date, which: 'sunrise' | 'sunset', hours: number) => new Date(sunTimes(day, CENTER[1], CENTER[0])[which]!.getTime() + hours * 3600e3);
const run = (g: ReturnType<typeof ground>, at: Date, o: Partial<Parameters<typeof turkeySitSpots>[0]> = {}) =>
  turkeySitSpots({ grid: g, cover: g.cover, forestType: g.forestType, at, weapon: 'shotgun', ...o });

describe('turkey season and phase', () => {
  it('knows spring from fall', () => {
    expect(turkeySeason(spring)).toBe('spring');
    expect(turkeySeason(fall)).toBe('fall');
    expect(turkeySeason(new Date('2026-07-10T12:00:00Z'))).toBe('off');
  });
  it('is on the roost around dawn, up and about by day, and dark at night', () => {
    expect(turkeyPhase(rel(spring, 'sunrise', -0.5), CENTER[1], CENTER[0])).toBe('roost');
    expect(turkeyPhase(rel(spring, 'sunrise', 2), CENTER[1], CENTER[0])).toBe('strut');
    expect(turkeyPhase(rel(spring, 'sunset', 2), CENTER[1], CENTER[0])).toBe('dark');
  });
  it('peaks late morning in spring, more than in fall', () => {
    const lateSpring = turkeyActivity(rel(spring, 'sunrise', 4), CENTER[1], CENTER[0]);
    const lateFall = turkeyActivity(rel(fall, 'sunrise', 4), CENTER[1], CENTER[0]);
    expect(lateSpring).toBeGreaterThan(lateFall);
    expect(lateSpring).toBeGreaterThan(turkeyActivity(rel(spring, 'sunrise', 7), CENTER[1], CENTER[0]));
  });
});

describe('turkey sit spots', () => {
  it('after fly-down sits on open ground beside woods, not in the timber', () => {
    const r = run(ground(split(41, 81)), rel(spring, 'sunrise', 4));
    expect(r.phase).toBe('strut');
    expect(r.spots.length).toBeGreaterThan(0);
    for (const s of r.spots) {
      expect(s.kind).toBe('strut_zone');
      expect(s.lngLat[0]).toBeGreaterThan(midLng);
    }
  });

  it('prefers a field edge with woods beside it to open ground far from any woods', () => {
    const cover = Array.from({ length: n }, (_, i) => (i % BOX.cols < 10 ? 41 : 81)); // woods, then pasture to the east edge
    const { spots } = run(ground(cover), rel(spring, 'sunrise', 4), { max: 1 });
    const col = ((spots[0]!.lngLat[0] - BOX.west) / (BOX.east - BOX.west)) * BOX.cols;
    expect(col).toBeLessThan(16);
  });

  it('at dawn sits on timber near an opening, and faces the opening', () => {
    const r = run(ground(split(41, 81)), rel(spring, 'sunrise', -0.5));
    expect(r.phase).toBe('roost');
    expect(r.spots.length).toBeGreaterThan(0);
    for (const s of r.spots) {
      expect(s.kind).toBe('roost');
      expect(s.lngLat[0]).toBeLessThan(midLng);
      expect(s.watchBearingDeg).toBeGreaterThan(0);
      expect(s.watchBearingDeg).toBeLessThan(180); // the opening is to the east
    }
  });

  it('prefers the ridge for a roost when openings are everywhere', () => {
    const cover = Array.from({ length: n }, (_, i) => (i % BOX.cols % 8 === 0 ? 81 : 41));
    const g = { ...ridge(0.3), cover };
    const { spots } = run(g as ReturnType<typeof ground>, rel(spring, 'sunrise', -0.5), { max: 1 });
    expect(Math.abs(spots[0]!.lngLat[0] - midLng)).toBeLessThan((BOX.east - BOX.west) / 4);
  });

  it('gives no spots at night, and none without any usable ground, and says unsure', () => {
    expect(run(ground(split(41, 81)), rel(spring, 'sunset', 2))).toMatchObject({ spots: [], unsure: true });
    const water = run(ground(split(11, 11)), rel(spring, 'sunrise', 4));
    expect(water.spots).toEqual([]);
    expect(water.unsure).toBe(true);
  });

  it('has no spots when there is timber but no opening to strut in', () => {
    expect(run(ground(split(41, 41)), rel(spring, 'sunrise', 4)).spots).toEqual([]);
  });

  it('returns spread-out spots in the SitSpot shape, with eyes-and-ears wording and no scent talk', () => {
    const r = run(ground(split(41, 81)), rel(spring, 'sunrise', 4));
    expect(r.spots.map((s) => s.rank)).toEqual(r.spots.map((_, i) => i + 1));
    for (const s of r.spots) {
      expect(s.reason).toMatch(/still/i);
      expect(s.reason).not.toMatch(/scent|wind/i);
      expect(s.score).toBeGreaterThan(0);
      expect(s.score).toBeLessThanOrEqual(1);
    }
  });

  it('is sure on good ground in prime hours and unsure in the midday lull', () => {
    expect(run(ground(split(41, 81)), rel(spring, 'sunrise', 4)).unsure).toBe(false);
    expect(run(ground(split(41, 81)), rel(fall, 'sunrise', 6)).unsure).toBe(true);
  });
});
