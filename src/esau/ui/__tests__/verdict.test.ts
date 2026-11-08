import { describe, expect, it } from 'vitest';
import { boxIncluding } from '../../../home/AnalyzePill';
import { verdictWords } from '../VerdictCard';
import type { LngLat } from '../../../model/geo';

const at: LngLat = [-85.5, 37.5];
const spot = (rank: number, lngLat: LngLat) => ({ rank, lngLat, watchBearingDeg: 0, score: 1, yardsToTrail: 20, reason: '' });
const base = { at, of: 'sit' as const, better: [], rangeYd: 35 };

describe('stay-or-move card, in plain words', () => {
  it('says stay with a score out of 100, never "% as good"', () => {
    const w = verdictWords({ ...base, pct: 86, stay: true });
    expect(w.call).toBe('Stay here');
    expect(w.score).toBe('Score 86 / 100');
    expect(w.detail).not.toMatch(/as good/);
    expect(w.better).toEqual([]);
  });
  it('calls the best spot the best spot', () => {
    expect(verdictWords({ ...base, pct: 100, stay: true }).detail).toMatch(/best spot Esau found/);
  });
  it('explains a zero: no trail within range, and how far the nearest is', () => {
    const w = verdictWords({ ...base, pct: 0, stay: false, why: 'out_of_range', trailYd: 212 });
    expect(w.call).toBe('Move');
    expect(w.score).toBe('Score 0 / 100');
    expect(w.detail).toMatch(/no predicted deer trail within 35 yd/i);
    expect(w.detail).toContain('210 yd');
    expect(w.detail).not.toMatch(/as good/);
  });
  it('says plainly when the wind carries scent onto the trail or a bed', () => {
    expect(verdictWords({ ...base, pct: 12, stay: false, why: 'scent_on_trail' }).detail).toMatch(/wind carries your scent onto the trail/i);
    expect(verdictWords({ ...base, pct: 0, stay: false, why: 'bed_downwind' }).detail).toMatch(/where deer bed/i);
  });
  it('lists the better spots with distance and direction', () => {
    const w = verdictWords({ ...base, pct: 30, stay: false, better: [spot(1, [-85.5, 37.501])], of: 'hunter' });
    expect(w.better[0]).toMatch(/^#1: \d+ yd N$/);
    expect(w.detail).toMatch(/where you stand/i);
  });
  it('points to a better spot just off the screen', () => {
    const w = verdictWords({ ...base, pct: 10, stay: false, offScreen: spot(1, [-85.5, 37.497]) });
    expect(w.detail).toMatch(/\d+ yd S, just off the screen/);
  });
});

describe('zooming out to a spot just off the screen', () => {
  const view = { west: -85.51, east: -85.49, south: 37.49, north: 37.51 };
  it('grows the screen only toward the spot, with a margin', () => {
    const b = boxIncluding(view, [-85.5, 37.52]);
    expect(b.north).toBeGreaterThan(37.52);
    expect([b.west, b.east, b.south]).toEqual([view.west, view.east, view.south]);
  });
  it('leaves the screen alone when the spot is already on it', () => {
    expect(boxIncluding(view, [-85.5, 37.5])).toEqual(view);
  });
});
