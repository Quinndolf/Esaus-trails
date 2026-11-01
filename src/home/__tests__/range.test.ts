import { describe, expect, it } from 'vitest';
import { rangeNote, WORKING_RANGE_YD } from '../range';

describe('range reader', () => {
  it('compares the distance with the weapon working range', () => {
    expect(rangeNote('bow', 22)).toBe('22 yd · within bow range');
    expect(rangeNote('bow', 30)).toBe('30 yd · within bow range');
    expect(rangeNote('bow', 45)).toBe('45 yd · beyond bow range (about 30 yd)');
    expect(rangeNote('pellet', 40)).toBe('40 yd · within pellet gun range');
    expect(rangeNote('pellet', 70)).toBe('70 yd · beyond pellet gun range (about 40 yd)');
    expect(rangeNote(null, 70)).toBe('70 yd');
  });
  it('has a working range for every weapon', () => {
    for (const w of ['bow', 'crossbow', 'rifle', 'muzzleloader', 'shotgun', 'pellet'] as const) expect(WORKING_RANGE_YD[w]).toBeGreaterThan(0);
  });
});
