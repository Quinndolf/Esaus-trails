import { describe, expect, it } from 'vitest';
import { groundFits, viewBbox } from '../ground';

const miLat = (b: { south: number; north: number }) => (b.north - b.south) * 69;
const around = (lat: number, lng: number, halfLat: number, halfLng: number) => ({ west: lng - halfLng, east: lng + halfLng, south: lat - halfLat, north: lat + halfLat });

describe('viewBbox', () => {
  it('zoomed way in still reads about 200 acres (0.6 mi)', () => {
    const b = viewBbox(around(37, -85.7, 0.0005, 0.0006));
    expect(miLat(b)).toBeCloseTo(0.6, 2);
  });
  it('zoomed way out is capped at a few square miles (2 mi)', () => {
    const b = viewBbox(around(37, -85.7, 0.2, 0.25));
    expect(miLat(b)).toBeCloseTo(2, 2);
  });
  it('a mid zoom follows the screen and stays centered', () => {
    const v = around(37, -85.7, 0.01, 0.012);
    const b = viewBbox(v);
    expect(miLat(b)).toBeCloseTo(1.38, 2);
    expect((b.north + b.south) / 2).toBeCloseTo(37, 6);
    expect((b.east + b.west) / 2).toBeCloseTo(-85.7, 6);
  });
});

describe('groundFits', () => {
  const g = around(37, -85.7, 0.0145, 0.018);
  it('keeps the grid when the view is near its center at the same scale', () => {
    expect(groundFits(g, around(37.002, -85.699, 0.0145, 0.018))).toBe(true);
  });
  it('reloads when you zoom in a lot or walk off the grid', () => {
    expect(groundFits(g, around(37, -85.7, 0.005, 0.006))).toBe(false);
    expect(groundFits(g, around(37.05, -85.7, 0.0145, 0.018))).toBe(false);
  });
});
