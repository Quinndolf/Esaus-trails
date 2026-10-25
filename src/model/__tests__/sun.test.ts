import { describe, expect, it } from 'vitest';
import { sunPosition, sunTimes } from '../sun';

describe('sun', () => {
  it('puts the late-October sun about 40 degrees up, due south, at Kentucky solar noon', () => {
    const { solarNoon } = sunTimes(new Date('2026-10-25T15:00:00Z'), 37.5, -85.5);
    const p = sunPosition(new Date(solarNoon.getTime() - 16 * 60e3), 37.5, -85.5); // equation of time, late Oct
    expect(p.altitude).toBeGreaterThan(38);
    expect(p.altitude).toBeLessThan(42);
    expect(p.azimuth).toBeGreaterThan(175);
    expect(p.azimuth).toBeLessThan(185);
  });

  it('finds sunrise and sunset within a few minutes of the almanac', () => {
    // Bardstown KY, 2026-10-25: sunrise ~8:05 EDT (12:05Z), sunset ~6:47 EDT (22:47Z).
    const t = sunTimes(new Date('2026-10-25T15:00:00Z'), 37.8, -85.47);
    const rise = t.sunrise!.getTime();
    const set = t.sunset!.getTime();
    expect(Math.abs(rise - Date.parse('2026-10-25T12:05:00Z'))).toBeLessThan(8 * 60e3);
    expect(Math.abs(set - Date.parse('2026-10-25T22:47:00Z'))).toBeLessThan(8 * 60e3);
  });

  it('is below the horizon at 2 am', () => {
    expect(sunPosition(new Date('2026-10-25T06:00:00Z'), 37.5, -85.5).altitude).toBeLessThan(-30);
  });
});
