import { describe, expect, it } from 'vitest';
import { createConditionsModel } from '../conditions';
import { stepYards } from '../geo';
import { CENTER, KY_11AM, KY_2AM, southFace, steadyForecast } from './fixtures';

describe('conditions model', () => {
  const model = createConditionsModel(southFace(), steadyForecast({ windMph: 2, windFrom: 270, skyCoverPct: 10 }));

  it('gives the slider an hour list and memoizes each hour', () => {
    const hours = model.hours(24, new Date('2026-10-25T05:37:00Z'));
    expect(hours).toHaveLength(24);
    expect(hours[0].toISOString()).toBe('2026-10-25T05:00:00.000Z');
    expect(model.at(KY_11AM)).toBe(model.at(new Date(KY_11AM)));
  });

  it('flips the same spot from rising at 11 am to sinking at 2 am', () => {
    expect(model.read(CENTER, KY_11AM).thermal.state).toBe('Rising');
    expect(model.read(CENTER, KY_2AM).thermal.state).toBe('Sinking');
  });

  it('reads a spot in plain words for Esau', () => {
    const r = model.read(CENTER, KY_11AM);
    expect(r.inGrid).toBe(true);
    expect(r.facing).toBe(180);
    expect(r.slopeDeg).toBe(14);
    expect(r.brief).toMatch(/facing south/);
    expect(r.brief).toMatch(/Thermal: rising/);
    expect(r.brief).toMatch(/Scent drifts north/);
    expect(r.scent.plume?.path.length).toBeGreaterThan(2);
  });

  it('says so when the spot is off the analyzed ground', () => {
    const r = model.read(stepYards(CENTER, 0, 5000), KY_11AM);
    expect(r.inGrid).toBe(false);
    expect(r.brief).toMatch(/outside the analyzed ground/);
  });

  it('is quick enough to scrub: 24 hours of a 32x32 grid well under a second', () => {
    const m = createConditionsModel(southFace(), steadyForecast());
    const t0 = performance.now();
    for (const h of m.hours(24, new Date('2026-10-25T00:00:00Z'))) m.at(h);
    expect(performance.now() - t0).toBeLessThan(1000);
  });
});
