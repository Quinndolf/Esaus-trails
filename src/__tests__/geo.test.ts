import { describe, expect, it } from 'vitest';
import { angleDelta, cardinal, coneRing, destination, normalizeBearing } from '../map/geo';



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

});

