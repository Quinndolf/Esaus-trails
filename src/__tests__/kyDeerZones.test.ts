import { describe, expect, it } from 'vitest';
import { KY_DEER_ZONE_BY_COUNTY, KY_DEER_ZONE_CHANGED, kyDeerZonesGeoJSON } from '../layers/kyDeerZones';
import { ALL_LAYERS } from '../layers/registry';

describe('Kentucky deer zones', () => {
  it('assigns every one of the 120 counties, with the guide map counts', () => {
    const zones = Object.values(KY_DEER_ZONE_BY_COUNTY);
    expect(zones).toHaveLength(120);
    const count = (z: number) => zones.filter((v) => v === z).length;
    expect([count(1), count(2), count(3), count(4)]).toEqual([68, 24, 13, 15]);
    expect(KY_DEER_ZONE_CHANGED.size).toBe(30);
    for (const c of KY_DEER_ZONE_CHANGED) expect(KY_DEER_ZONE_BY_COUNTY[c]).toBeDefined();
  });

  it('spot-checks a few counties from the 2026-27 map', () => {
    expect(KY_DEER_ZONE_BY_COUNTY.Fulton).toBe(1);
    expect(KY_DEER_ZONE_BY_COUNTY.Fayette).toBe(2);
    expect(KY_DEER_ZONE_BY_COUNTY.Pike).toBe(3);
    expect(KY_DEER_ZONE_BY_COUNTY.Harlan).toBe(4);
  });

  it('tags every county outline with its zone', async () => {
    const fc = await kyDeerZonesGeoJSON();
    expect(fc.features).toHaveLength(120);
    expect(fc.features.every((f) => [1, 2, 3, 4].includes(f.properties!.zone))).toBe(true);
    expect(fc.features.find((f) => f.properties!.name === 'Pike')!.properties!.changed).toBe(true);
  });

  it('sits in the Kentucky hunting districts with one view option per zone', () => {
    const layer = ALL_LAYERS.find((l) => l.id === 'ky-deer-zones')!;
    expect(layer.source.kind).toBe('geojson');
    expect(layer.options!.map((o) => o.value)).toEqual([1, 2, 3, 4]);
  });
});
