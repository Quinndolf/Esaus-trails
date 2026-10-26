import { hollowGrid } from '../esau/fixtures/hollow';
import { hourWeights, likelihoodField } from '../hour/likelihood';
import { describe, expect, it } from 'vitest';
import { callsFor } from '../calls/catalog';
import { SPECIES, signFits } from '../esau/species';
import { foldersFor, scopeLayerState } from '../layers/registry';
import { createConditionsModel } from '../model/conditions';
import { CENTER, KY_11AM, southFace, steadyForecast } from '../model/__tests__/fixtures';
import { activityFor, dayStrip, hourScope, nextFlip } from '../hour/scope';

const ids = (species: Parameters<typeof foldersFor>[0]) => foldersFor(species).flatMap((f) => f.layers.map((l) => l.id));

describe('hunting one animal', () => {
  it('shows each animal only its own map layers', () => {
    expect(ids('whitetail')).toContain('ky-deer-zones');
    expect(ids('whitetail')).not.toContain('ky-elk-units');
    expect(ids('elk')).toContain('ky-elk-units');
    expect(ids('elk')).not.toContain('ky-deer-zones');
    expect(ids('squirrel')).not.toContain('ky-deer-zones');
    expect(ids('squirrel')).not.toContain('ky-elk-zone');
    expect(ids(null)).not.toContain('ky-deer-zones');
  });

  it('switches off, rather than just hides, layers meant for another animal', () => {
    const on = { on: { 'ky-deer-zones': true, 'ky-elk-units': true, hillshade: true }, options: {} };
    const s = scopeLayerState(on, 'turkey');
    expect(s.on['ky-deer-zones']).toBe(false);
    expect(s.on['ky-elk-units']).toBe(false);
    expect(s.on.hillshade).toBe(true);
    expect(scopeLayerState(on, 'elk').on['ky-elk-units']).toBe(true);
  });

  it('gives each animal only its own calls', () => {
    expect(new Set(callsFor('whitetail').map((c) => c.species))).toEqual(new Set(['deer']));
    expect(new Set(callsFor('squirrel').map((c) => c.species))).toEqual(new Set(['squirrel']));
    expect(new Set(callsFor('turkey').map((c) => c.species))).toEqual(new Set(['turkey']));
    expect(callsFor('black_bear')).toEqual([]);
    expect(callsFor(null)).toEqual([]);
  });

  it('offers rubs and scrapes to deer hunters only', () => {
    expect(signFits('rub', 'whitetail')).toBe(true);
    expect(signFits('rub', 'squirrel')).toBe(false);
    expect(signFits('scrape', 'turkey')).toBe(false);
    expect(signFits('food', 'turkey')).toBe(true);
  });

  it('lists squirrel as a ready animal', () => {
    expect(SPECIES.find((s) => s.id === 'squirrel')?.ready).toBe(true);
  });
});

describe('hour slider scope', () => {
  it('runs the deer movement model for whitetail only', () => {
    expect(hourScope('whitetail')).toMatchObject({ movement: true, thermals: true, scent: true });
    expect(hourScope('elk')).toMatchObject({ movement: false, thermals: true });
    expect(hourScope('turkey')).toMatchObject({ movement: false, thermals: false, scent: false, strip: 'activity' });
    expect(hourScope('squirrel')).toMatchObject({ movement: false, thermals: false, strip: 'activity' });
    expect(hourScope('ginseng')).toBeNull();
    expect(hourScope(null)).toBeNull();
  });

  const grid = southFace();
  const model = createConditionsModel(grid, steadyForecast({ windMph: 3, windFrom: 270 }));
  const hours = model.hours(24, KY_11AM);

  it('puts squirrels at first light and in the evening, not at night or hot midday', () => {
    const levels = hours.map((h) => activityFor('squirrel', model.at(h))!.level);
    expect(Math.max(...levels)).toBeGreaterThan(0.6);
    expect(Math.min(...levels)).toBe(0);
    expect(activityFor('whitetail', model.at(KY_11AM))).toBeNull();
  });

  it('builds a strip with one cell per hour and finds the next thermal flip', () => {
    const cells = dayStrip('whitetail', model, grid, CENTER, hours);
    expect(cells).toHaveLength(24);
    expect(new Set(cells.map((c) => c.state)).size).toBeGreaterThan(1);
    const lines = cells.map((_, k) => nextFlip(cells, k)).filter(Boolean);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines[0]).toMatch(/^Thermals (turn|settle)/);
  });
});

describe('hourScope', () => {
  it('returns the same object every call so store selectors stay stable', () => {
    for (const id of Object.keys(SPECIES) as Parameters<typeof hourScope>[0][]) expect(hourScope(id)).toBe(hourScope(id));
  });
});

describe('hour slider uses each hour\'s forecast', () => {
  it('gives each hour its own wind and lets a windy hour wash the thermals out', () => {
    const grid = southFace();
    const base = steadyForecast({ windMph: 2, windFrom: 270 });
    const hours = base.hours.map((h, k) => (k >= 5 ? { ...h, windMph: 20, windFrom: 90, skyCoverPct: 100 } : h));
    const model = createConditionsModel(grid, { ...base, hours });
    const calm = model.at(new Date(hours[2].at));
    const windy = model.at(new Date(hours[8].at));
    expect(calm.weather.windMph).toBeLessThan(5);
    expect(windy.weather.windMph).toBeGreaterThan(15);
    expect(windy.weather.windFrom).toBe(90);
    expect(windy.thermal.thermalWindow).toBeLessThan(calm.thermal.thermalWindow);
  });
});

describe('likelihood shading for animals without a movement model', () => {
  const g = hollowGrid();
  const hc = (alt: number, az: number) =>
    ({ date: new Date('2026-10-25T15:00:00Z'), sun: { altitude: alt, azimuth: az }, weather: { windMph: 4, windFrom: 270, tempF: 55 } }) as never;

  it('scores every cell 0-1 with the likeliest at 1, for each animal', () => {
    for (const sp of ['elk', 'turkey', 'squirrel', 'hog', 'black_bear', 'mule_deer'] as const) {
      const f = likelihoodField(g, sp, hc(30, 120))!;
      expect(f).toHaveLength(32 * 32);
      expect(Math.max(...f)).toBeCloseTo(1, 5);
      expect(Math.min(...f)).toBeGreaterThanOrEqual(0);
    }
  });

  it('moves the shading as the hour changes', () => {
    const day = likelihoodField(g, 'squirrel', hc(40, 180))!;
    const night = likelihoodField(g, 'squirrel', hc(-30, 0))!;
    expect(day.some((v, i) => Math.abs(v - night[i]) > 0.1)).toBe(true);
    expect(hourWeights('squirrel', -30, 0).rest).toBe(1);
    expect(hourWeights('elk', 40, 180).rest).toBeGreaterThan(0.5);
  });
});
