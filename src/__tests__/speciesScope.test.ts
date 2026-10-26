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
