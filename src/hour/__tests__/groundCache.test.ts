// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { saveGround, nearestSavedGround, ageLabel, MAX_SAVED } from '../groundCache';
import { bboxAround } from '../ground';

const grid = (lng: number, lat: number) => {
  const b = bboxAround([lng, lat]);
  return { ...b, cols: 2, rows: 2, elevationM: [1, 2, 3, 4], cover: [1, 1, 1, 1], crop: [0, 0, 0, 0], weather: { source: 'nws', hours: [{ time: 'x' }] } } as any;
};

describe('saved ground for no-service use', () => {
  beforeEach(() => localStorage.clear());

  it('returns the saved ground near where the hunter is, with when it was saved', () => {
    saveGround(grid(-85.5, 37.5), 1000);
    const hit = nearestSavedGround([-85.505, 37.502])!;
    expect(hit.savedAt).toBe(1000);
    expect(hit.grid.elevationM).toEqual([1, 2, 3, 4]);
  });

  it('ignores ground that is too far away', () => {
    saveGround(grid(-85.5, 37.5), 1000);
    expect(nearestSavedGround([-86.5, 37.5])).toBeNull();
  });

  it('keeps only the most recent few', () => {
    for (let i = 0; i < MAX_SAVED + 2; i++) saveGround(grid(-85.5 - i * 0.2, 37.5), i);
    expect(nearestSavedGround([-85.5, 37.5])).toBeNull(); // the oldest was dropped
    expect(nearestSavedGround([-85.5 - (MAX_SAVED + 1) * 0.2, 37.5])).not.toBeNull();
  });

  it('survives blocked or broken storage', () => {
    localStorage.setItem('esau-ground-cache', '{nope');
    expect(nearestSavedGround([-85.5, 37.5])).toBeNull();
    expect(() => saveGround(grid(-85.5, 37.5), 1)).not.toThrow();
  });

  it('says how old the weather is', () => {
    expect(ageLabel(0, 20 * 60e3)).toBe('20 min ago');
    expect(ageLabel(0, 3 * 3600e3 + 5 * 60e3)).toBe('3 hours ago');
    expect(ageLabel(0, 30 * 3600e3)).toBe('over a day ago');
  });
});
