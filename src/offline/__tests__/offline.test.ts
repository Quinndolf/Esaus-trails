// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { offlineOverlays } from '../../layers/offline';
import { ALL_LAYERS } from '../../layers/registry';
import { tileUrls } from '../../layers/tiles';
import { estimate, listAreas, saveArea, type OfflineOverlay } from '../store';
import { countTiles, tileBBox3857, tileUrl, type Bounds } from '../tiles';

// A small patch of Kentucky woods.
const B: Bounds = { west: -85.31, south: 37.59, east: -85.29, north: 37.61 };

describe('bbox tiles', () => {
  it('fills {bbox-epsg-3857} the way MapLibre does', () => {
    expect(tileBBox3857({ z: 0, x: 0, y: 0 })).toBe('-20037508.342789244,-20037508.342789244,20037508.342789244,20037508.342789244');
    // z1 top-left quarter: west half, north half.
    expect(tileBBox3857({ z: 1, x: 0, y: 0 })).toBe('-20037508.342789244,0,0,20037508.342789244');
    const url = tileUrl('https://h/export?bbox={bbox-epsg-3857}&f=image', { z: 1, x: 1, y: 1 });
    expect(url).toBe('https://h/export?bbox=0,-20037508.342789244,20037508.342789244,0&f=image');
  });

  it('every overlay template turns into a concrete URL', () => {
    for (const l of ALL_LAYERS) for (const t of tileUrls(l)) expect(tileUrl(t, { z: 15, x: 8620, y: 12650 })).not.toMatch(/[{}]/);
  });
});

describe('overlays in offline areas', () => {
  it('takes the layers that are on, minus live radar and empty picks', () => {
    const on = { 'ky-hunting-areas': true, radar: true, hillshade: true, crops: true, 'ky-deer-zones': true };
    const picked = offlineOverlays({ on, options: { crops: [] } });
    expect(picked.map((o) => o.id).sort()).toEqual(['hillshade', 'ky-hunting-areas']);
  });

  it('counts layer tiles only at the zooms the layer draws', () => {
    const parcels: OfflineOverlay = { id: 'p', name: 'Parcels', templates: ['https://p/{z}/{x}/{y}'], minzoom: 15, maxzoom: 17 };
    const base = estimate('satellite', B, 10, 16);
    expect(estimate('satellite', B, 10, 16, [parcels])).toBe(base + countTiles(B, 15, 16));
    const lowOnly: OfflineOverlay = { ...parcels, minzoom: 17 };
    expect(estimate('satellite', B, 10, 16, [lowOnly])).toBe(base);
  });
});

describe('saveArea', () => {
  const stored = new Map<string, Response>();
  beforeEach(() => {
    stored.clear();
    localStorage.clear();
    vi.stubGlobal('caches', {
      open: async () => ({ put: async (url: string, res: Response) => void stored.set(url, res) }),
      delete: async () => true,
    });
    vi.stubGlobal('fetch', async () => new Response('png', { status: 200 }));
  });

  it('downloads the basemap and each layer and records the layer names', async () => {
    const hunting = offlineOverlays({ on: { 'ky-hunting-areas': true }, options: {} });
    const area = await saveArea(
      { name: 'Back forty', basemap: 'satellite', bounds: B, minZoom: 14, maxZoom: 15, overlays: hunting },
      () => {},
      new AbortController().signal,
    );
    expect(area.tiles).toBe(estimate('satellite', B, 14, 15, hunting));
    expect(area.overlays).toEqual([hunting[0].name]);
    expect([...stored.keys()].some((u) => u.includes('/export?bbox=') && !u.includes('{'))).toBe(true);
    expect(listAreas()[0]).toMatchObject({ name: 'Back forty', overlays: [hunting[0].name] });
  });
});
