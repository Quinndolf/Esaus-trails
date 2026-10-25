import { describe, expect, it } from 'vitest';
import { ALL_LAYERS, FOLDERS } from '../layers/registry';
import { activeOptionIds, tileUrls } from '../layers/tiles';

const byId = (id: string) => ALL_LAYERS.find((l) => l.id === id)!;

describe('layer registry', () => {
  it('has unique layer ids and only Kentucky as a state', () => {
    const ids = ALL_LAYERS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...new Set(FOLDERS.filter((f) => f.state).map((f) => f.state))]).toEqual(['KY']);
  });

  it('covers the folders from the spec', () => {
    const names = FOLDERS.map((f) => f.name);
    for (const n of ['Private Lands', 'Government Lands', 'Hunting Districts', 'Current Conditions', 'Land and Access', 'Roads', 'Trails', 'Trees', 'Crops', 'Soil', 'Wildlife'])
      expect(names).toContain(n);
  });

  it('every layer yields at least one https tile template with a placeholder', () => {
    for (const l of ALL_LAYERS) {
      const urls = tileUrls(l);
      expect(urls.length).toBeGreaterThan(0);
      for (const u of urls) {
        expect(u.startsWith('https://')).toBe(true);
        expect(u).toMatch(/\{bbox-epsg-3857\}|\{z\}/);
      }
    }
  });
});

describe('tile urls', () => {
  it('builds an ArcGIS export with the picked sub-layers', () => {
    const l = byId('ky-hunting-areas');
    expect(tileUrls(l)[0]).toContain('layers=show%3A1%2C0');
    expect(tileUrls(l, ['restricted'])[0]).toContain('layers=show%3A0');
    expect(tileUrls(l)[0]).toContain('bbox={bbox-epsg-3857}');
  });

  it('ORs view-option filters onto the base definition query', () => {
    const url = new URL(tileUrls(byId('ky-state-managed'))[0]).searchParams.get('layerDefs');
    expect(url).toContain(`"0":"(State_Nm = 'KY' AND Mang_Type = 'STAT') AND ((Pub_Access = 'OA') OR (Pub_Access = 'RA'))"`);
  });

  it('respects default-off options and exclusive picks', () => {
    expect(activeOptionIds(byId('public-access'), undefined)).toEqual(['open', 'restricted']);
    expect(tileUrls(byId('cropland'))[0]).toContain('layers=cdl_2025');
    expect(tileUrls(byId('cropland'), ['2023'])[0]).toContain('layers=cdl_2023');
  });

  it('builds WMS 1.1.1 GetMap in web mercator', () => {
    const u = tileUrls(byId('canopy'))[0];
    expect(u).toContain('request=GetMap');
    expect(u).toContain('srs=EPSG%3A3857');
    expect(u.endsWith('&bbox={bbox-epsg-3857}')).toBe(true);
  });
});
