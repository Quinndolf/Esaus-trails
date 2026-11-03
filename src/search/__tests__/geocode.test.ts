import { describe, expect, it, vi } from 'vitest';
import { geocode, parseLatLng } from '../geocode';

describe('parseLatLng', () => {
  it('reads plain decimal pairs', () => {
    expect(parseLatLng('37.6, -85.3')).toEqual({ lat: 37.6, lng: -85.3 });
    expect(parseLatLng('37.6 -85.3')).toEqual({ lat: 37.6, lng: -85.3 });
    expect(parseLatLng('  37.6,-85.3  ')).toEqual({ lat: 37.6, lng: -85.3 });
  });
  it('reads N/S/E/W letters', () => {
    expect(parseLatLng('37.6 N, 85.3 W')).toEqual({ lat: 37.6, lng: -85.3 });
    expect(parseLatLng('N37.6 W85.3')).toEqual({ lat: 37.6, lng: -85.3 });
    expect(parseLatLng('37.6S 85.3E')).toEqual({ lat: -37.6, lng: 85.3 });
  });
  it('rejects out-of-range numbers and ordinary addresses', () => {
    expect(parseLatLng('137.6, -85.3')).toBeNull();
    expect(parseLatLng('37.6, -185.3')).toBeNull();
    expect(parseLatLng('123 Main St, Bardstown KY')).toBeNull();
    expect(parseLatLng('')).toBeNull();
  });
});

describe('geocode', () => {
  it('returns coordinates without calling the network', async () => {
    const f = vi.fn();
    const r = await geocode('37.6, -85.3', f as unknown as typeof fetch);
    expect(r).toEqual([{ label: '37.6000, -85.3000', lat: 37.6, lng: -85.3 }]);
    expect(f).not.toHaveBeenCalled();
  });
  it('asks Nominatim once and maps the answers', async () => {
    const f = vi.fn(async () => ({
      ok: true,
      json: async () => [{ display_name: 'Bardstown, Nelson County, Kentucky, United States', lat: '37.8092', lon: '-85.4669', boundingbox: ['37.77', '37.84', '-85.5', '-85.43'] }],
    }));
    const r = await geocode('Bardstown KY', f as unknown as typeof fetch);
    expect(f).toHaveBeenCalledTimes(1);
    const url = String((f.mock.calls[0] as unknown[])[0]);
    expect(url).toContain('nominatim.openstreetmap.org/search');
    expect(url).toContain('q=Bardstown+KY');
    expect(url).toContain('format=jsonv2');
    expect(r[0]).toMatchObject({ lat: 37.8092, lng: -85.4669, bbox: [-85.5, 37.77, -85.43, 37.84] });
    expect(r[0].label).toContain('Bardstown');
  });
  it('throws a plain error when the service is down', async () => {
    const f = vi.fn(async () => ({ ok: false, status: 503 }));
    await expect(geocode('somewhere', f as unknown as typeof fetch)).rejects.toThrow(/search/i);
  });
  it('ignores empty queries', async () => {
    const f = vi.fn();
    expect(await geocode('   ', f as unknown as typeof fetch)).toEqual([]);
    expect(f).not.toHaveBeenCalled();
  });
});

import { didYouMean, suggest } from '../geocode';

const feature = (p: Record<string, unknown>, c: [number, number]) => ({ properties: p, geometry: { coordinates: c } });
const photon = (features: unknown[]) => vi.fn(async () => ({ ok: true, json: async () => ({ features }) }));

describe('suggest (Photon)', () => {
  it('maps matches to labelled places, biased toward the map centre', async () => {
    const f = photon([
      feature({ housenumber: '12', street: 'Main St', city: 'Bardstown', state: 'Kentucky', extent: [-85.5, 37.9, -85.4, 37.8] }, [-85.46, 37.81]),
      feature({ name: 'Bardstown', state: 'Kentucky', country: 'United States' }, [-85.47, 37.8]),
    ]);
    const r = await suggest('12 main bardstown', [-85.3, 37.6], f as unknown as typeof fetch);
    const url = String((f.mock.calls[0] as unknown[])[0]);
    expect(url).toContain('photon.komoot.io/api');
    expect(url).toContain('lat=37.6');
    expect(url).toContain('lon=-85.3');
    expect(r[0]).toMatchObject({ label: '12 Main St, Bardstown, Kentucky', lat: 37.81, lng: -85.46, bbox: [-85.5, 37.8, -85.4, 37.9] });
    expect(r[1].label).toBe('Bardstown, Kentucky');
  });
  it('skips short text and coordinates', async () => {
    const f = photon([]);
    expect(await suggest('ba', null, f as unknown as typeof fetch)).toEqual([]);
    expect(await suggest('37.6, -85.3', null, f as unknown as typeof fetch)).toEqual([]);
    expect(f).not.toHaveBeenCalled();
  });
  it('throws a plain error when the service is down', async () => {
    const f = vi.fn(async () => ({ ok: false, status: 500 }));
    await expect(suggest('bardstown', null, f as unknown as typeof fetch)).rejects.toThrow(/search/i);
  });
});

describe('didYouMean', () => {
  it('drops trailing words until something matches', async () => {
    const f = vi.fn(async (u: string) => ({
      ok: true,
      json: async () => ({ features: String(u).includes('q=Bardstwn') ? [feature({ name: 'Bardstown', state: 'Kentucky' }, [-85.47, 37.8])] : [] }),
    }));
    const r = await didYouMean('Bardstwn Kentuky', null, f as unknown as typeof fetch);
    expect(r?.label).toBe('Bardstown, Kentucky');
  });
  it('returns null when nothing is close', async () => {
    expect(await didYouMean('qqq zzz', null, photon([]) as unknown as typeof fetch)).toBeNull();
  });
});
