import { describe, expect, it } from 'vitest';
import { boxIncluding } from '../../../home/AnalyzePill';
import { verdictWords } from '../VerdictCard';
import type { LngLat } from '../../../model/geo';

const at: LngLat = [-85.5, 37.5];
const spot = (rank: number, lngLat: LngLat) => ({ rank, lngLat, watchBearingDeg: 0, score: 1, yardsToTrail: 20, reason: '' });

describe('stay-or-move card', () => {
  it('says stay with the percentage', () => {
    const w = verdictWords({ pct: 86, stay: true, better: [], at, of: 'sit' });
    expect(w.call).toBe('Stay · 86%');
    expect(w.better).toEqual([]);
  });
  it('says move and lists the better spots with distance and direction', () => {
    const w = verdictWords({ pct: 30, stay: false, better: [spot(1, [-85.5, 37.501])], at, of: 'hunter' });
    expect(w.call).toBe('Move · 30%');
    expect(w.detail).toContain('Where you stand');
    expect(w.better[0]).toMatch(/^#1: \d+ yd N$/);
  });
  it('points to a better spot just off the screen', () => {
    const w = verdictWords({ pct: 10, stay: false, better: [], at, of: 'sit', offScreen: spot(1, [-85.5, 37.497]) });
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
