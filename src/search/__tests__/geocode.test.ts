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
