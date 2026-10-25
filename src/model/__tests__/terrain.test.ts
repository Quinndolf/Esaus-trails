import { describe, expect, it } from 'vitest';
import { cellAt } from '../geo';
import { analyzeTerrain } from '../terrain';
import { CENTER, hollow, makeGrid, ridge, southFace } from './fixtures';

describe('terrain', () => {
  it('reads a south face: about 14 degrees at 25% grade, facing 180', () => {
    const t = analyzeTerrain(southFace(0.25));
    const i = cellAt(t.grid, CENTER)!;
    expect(t.slopeDeg[i]).toBeCloseTo(14.04, 0);
    expect(t.aspectDeg[i]).toBeCloseTo(180, 0);
  });

  it('calls flat ground aspect-less', () => {
    const t = analyzeTerrain(makeGrid(() => 200));
    expect(Number.isNaN(t.aspectDeg[100])).toBe(true);
    expect(t.slopeDeg[100]).toBe(0);
  });

  it('finds the draw in a hollow and the crest of a ridge', () => {
    const h = analyzeTerrain(hollow());
    const bottom = cellAt(h.grid, CENTER)!;
    const side = cellAt(h.grid, [CENTER[0] + 0.005, CENTER[1]])!;
    expect(h.drainage[bottom]).toBeGreaterThan(0.6);
    expect(h.position[bottom]).toBeLessThan(-0.3);
    expect(h.drainage[side]).toBeLessThan(h.drainage[bottom] * 0.5);

    const r = analyzeTerrain(ridge());
    expect(r.position[cellAt(r.grid, CENTER)!]).toBeGreaterThan(0.3);
    // West side faces west, east side faces east.
    expect(r.aspectDeg[cellAt(r.grid, [CENTER[0] - 0.004, CENTER[1]])!]).toBeCloseTo(270, 0);
    expect(r.aspectDeg[cellAt(r.grid, [CENTER[0] + 0.004, CENTER[1]])!]).toBeCloseTo(90, 0);
  });

  it('rejects a grid whose elevation length is wrong', () => {
    expect(() => analyzeTerrain({ ...southFace(), elevationM: [1, 2, 3] })).toThrow(/expected 32x32/);
  });
});
