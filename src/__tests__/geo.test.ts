import { describe, expect, it } from 'vitest';
import { angleDelta, cardinal, coneRing, destination, normalizeBearing } from '../map/geo';
import { nextBasemap } from '../map/basemaps';
import { countTiles, latToTileY, lngToTileX, tilesIn } from '../offline/tiles';

describe('geo', () => {
  it('moves north by about 111 km per degree', () => {
    const [lng, lat] = destination([-85, 37], 0, 111195);
    expect(lng).toBeCloseTo(-85, 6);
    expect(lat).toBeCloseTo(38, 3);
  });

  it('builds a closed cone facing the bearing', () => {
    const ring = coneRing([-85, 37], 90, 40, 200);
    expect(ring[0]).toEqual(ring[ring.length - 1]);
    const tip = ring[Math.floor(ring.length / 2)];
    expect(tip[0]).toBeGreaterThan(-85);
    expect(tip[1]).toBeCloseTo(37, 4);
  });

  it('names bearings and wraps angles', () => {
    expect(cardinal(0)).toBe('N');
    expect(cardinal(359)).toBe('N');
    expect(cardinal(135)).toBe('SE');
    expect(normalizeBearing(-10)).toBe(350);
    expect(angleDelta(350, 10)).toBe(20);
    expect(angleDelta(10, 350)).toBe(-20);
  });

  it('cycles satellite, topo, hybrid', () => {
    expect(nextBasemap('satellite')).toBe('topo');
    expect(nextBasemap('topo')).toBe('hybrid');
    expect(nextBasemap('hybrid')).toBe('streets');
    expect(nextBasemap('streets')).toBe('satellite');
  });
});

describe('tiles', () => {
  it('matches known slippy tile numbers', () => {
    expect(lngToTileX(-85.3, 10)).toBe(269);
    expect(latToTileY(37.6, 10)).toBe(396);
  });

  it('counts the same tiles it yields', () => {
    const b = { west: -85.32, south: 37.58, east: -85.28, north: 37.62 };
    expect([...tilesIn(b, 12, 16)].length).toBe(countTiles(b, 12, 16));
    expect(countTiles(b, 16, 16)).toBeGreaterThan(20);
  });
});
