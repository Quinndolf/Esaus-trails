import { describe, expect, it } from 'vitest';
import { windFade, thermalRgba } from '../shade';
import { ThermalState } from '../../model/types';

describe('thermal shading', () => {
  it('fades with wind: full to 15 mph, half at 17.5, gone at 20 and beyond', () => {
    expect(windFade(0)).toBe(1);
    expect(windFade(15)).toBe(1);
    expect(windFade(17.5)).toBeCloseTo(0.5);
    expect(windFade(25)).toBe(0);
  });

  it('paints rising air light blue and sinking air dark red', () => {
    const rise = thermalRgba(ThermalState.Rising, 1, 5);
    const sink = thermalRgba(ThermalState.Sinking, 1, 5);
    expect(rise[2]).toBeGreaterThan(rise[0]);
    expect(rise[2]).toBeGreaterThan(200);
    expect(sink[0]).toBeGreaterThan(sink[2]);
    expect(sink[0]).toBeLessThan(200);
    expect(thermalRgba(ThermalState.Pooling, 1, 5)[0]).toBeGreaterThan(thermalRgba(ThermalState.Pooling, 1, 5)[2]);
  });

  it('is clear where settled and scales alpha by wind fade', () => {
    expect(thermalRgba(ThermalState.Settled, 1, 0)[3]).toBe(0);
    const calm = thermalRgba(ThermalState.Rising, 1, 5)[3];
    expect(thermalRgba(ThermalState.Rising, 1, 17.5)[3]).toBeCloseTo(calm / 2, -1);
    expect(thermalRgba(ThermalState.Rising, 1, 22)[3]).toBe(0);
  });
});
