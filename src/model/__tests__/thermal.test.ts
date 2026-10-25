import { describe, expect, it } from 'vitest';
import { angleDiff, cellAt } from '../geo';
import { sunPosition, sunTimes } from '../sun';
import { analyzeTerrain } from '../terrain';
import { computeThermals, dayPhase, thermalWindow } from '../thermal';
import { ThermalState, type WeatherHour } from '../types';
import { CENTER, hollow, hour, KY_11AM, KY_2AM, KY_8_30AM, makeGrid, southFace } from './fixtures';

function thermalsAt(grid = southFace(), date = KY_11AM, w: Partial<WeatherHour> = {}) {
  const t = analyzeTerrain(grid);
  const sun = sunPosition(date, 37.5, -85.5);
  const field = computeThermals(t, {
    date,
    sun,
    sunTimes: sunTimes(date, 37.5, -85.5),
    weather: hour(date.toISOString(), w),
  });
  return { t, field, i: cellAt(t.grid, CENTER)! };
}

describe('thermals', () => {
  it('rises up a sunny south face late morning, flowing north', () => {
    const { field, i } = thermalsAt();
    expect(field.phase).toBe('day');
    expect(field.state[i]).toBe(ThermalState.Rising);
    expect(field.strength[i]).toBeGreaterThan(0.5);
    expect(angleDiff(field.flowBearing[i], 0)).toBeLessThan(2);
    expect(field.speedMph[i]).toBeGreaterThan(1);
  });

  it('drains down the same face at 2 am, flowing south', () => {
    const { field, i } = thermalsAt(southFace(), KY_2AM);
    expect(field.phase).toBe('night');
    expect(field.state[i]).toBe(ThermalState.Sinking);
    expect(angleDiff(field.flowBearing[i], 180)).toBeLessThan(2);
  });

  it('sinks on a shaded north face at midday', () => {
    const north = makeGrid((_x, y) => 250 - y * 0.6); // ~31 degrees facing north
    const { field, i } = thermalsAt(north);
    expect(field.state[i]).toBe(ThermalState.Sinking);
  });

  it('pools in a hollow bottom at night', () => {
    const { field, i } = thermalsAt(hollow(), KY_2AM);
    expect(field.state[i]).toBe(ThermalState.Pooling);
  });

  it('keeps draining half an hour after sunrise: the morning flip lags', () => {
    const { field, i } = thermalsAt(hollow(), KY_8_30AM);
    expect(field.phase).toBe('morning');
    expect([ThermalState.Sinking, ThermalState.Pooling]).toContain(field.state[i]);
  });

  it('washes out in a strong wind, gradually', () => {
    expect(thermalWindow(hour('', { windMph: 3 }))).toBe(1);
    expect(thermalWindow(hour('', { windMph: 8 }))).toBeGreaterThan(0.2);
    expect(thermalWindow(hour('', { windMph: 8 }))).toBeLessThan(0.8);
    expect(thermalWindow(hour('', { windMph: 15 }))).toBe(0);
    // Gusts count for some of it.
    expect(thermalWindow(hour('', { windMph: 8, gustMph: 25 }))).toBeLessThan(thermalWindow(hour('', { windMph: 8 })));
    const { field, i } = thermalsAt(southFace(), KY_11AM, { windMph: 16 });
    expect(field.state[i]).toBe(ThermalState.Settled);
  });

  it('is weaker under overcast and under heavy canopy', () => {
    const clear = thermalsAt().field.strength;
    const { field: cloudy, i } = thermalsAt(southFace(), KY_11AM, { skyCoverPct: 100 });
    expect(cloudy.strength[i]).toBeLessThan(clear[i] * 0.5);
    const timber = makeGrid((_x, y) => 250 + y * 0.25, { canopyPct: new Array(1024).fill(95) });
    expect(thermalsAt(timber).field.strength[i]).toBeLessThan(clear[i]);
  });

  it('names the phases', () => {
    const at = (iso: string) => {
      const date = new Date(iso);
      return dayPhase({ date, sun: sunPosition(date, 37.5, -85.5), sunTimes: sunTimes(date, 37.5, -85.5) });
    };
    expect(at('2026-10-25T06:00:00Z')).toBe('night');
    expect(at('2026-10-25T12:45:00Z')).toBe('morning');
    expect(at('2026-10-25T17:00:00Z')).toBe('day');
    expect(at('2026-10-25T22:00:00Z')).toBe('evening');
  });
});
