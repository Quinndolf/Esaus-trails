import { describe, expect, it } from 'vitest';
import { barSegments, lightMarks, readoutLine } from '../hourBar';
import type { StripCell } from '../../hour/scope';

const hours = Array.from({ length: 25 }, (_, i) => new Date(Date.UTC(2026, 10, 1, 5 + i)));
const cell = (i: number, state: number): StripCell => ({ date: hours[i], state, strength: 1, level: 0 });

describe('hour bar model', () => {
  it('merges runs of equal thermal state into fractions of the bar', () => {
    const cells = [cell(0, 1), cell(1, 1), cell(2, 0), cell(3, 2)];
    const seg = barSegments(cells);
    expect(seg).toEqual([
      { from: 0, to: 0.5, state: 1 },
      { from: 0.5, to: 0.75, state: 0 },
      { from: 0.75, to: 1, state: 2 },
    ]);
    expect(barSegments([])).toEqual([]);
  });

  it('places sunrise, sunset and legal light (30 min either side) along the day', () => {
    const rise = new Date(hours[0].getTime() + 2 * 3600e3);
    const set = new Date(hours[0].getTime() + 12 * 3600e3);
    const m = lightMarks(hours, rise, set);
    expect(m.sunrise).toBeCloseTo(2 / 24);
    expect(m.sunset).toBeCloseTo(12 / 24);
    expect(m.legalStart).toBeCloseTo(1.5 / 24);
    expect(m.legalEnd).toBeCloseTo(12.5 / 24);
  });

  it('clamps marks that fall outside the 24 hours', () => {
    const m = lightMarks(hours, new Date(hours[0].getTime() - 3600e3), new Date(hours[24].getTime() + 3600e3));
    expect(m.legalStart).toBe(0);
    expect(m.legalEnd).toBe(1);
  });

  it('writes the readout line', () => {
    expect(readoutLine({ stateWord: 'Rising', windMph: 6.4, windFrom: 315, tempF: 52.2 })).toBe('Rising · NW 6 mph · 52°');
  });
});
