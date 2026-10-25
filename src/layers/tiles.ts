import type { LayerDef } from './types';

const BBOX = '{bbox-epsg-3857}';

/** Option ids that are on for a layer: the hunter's picks, else the defaults, else all. */
export function activeOptionIds(layer: LayerDef, picked: string[] | undefined): string[] {
  if (!layer.options) return [];
  if (picked) return picked;
  const defaults = layer.options.filter((o) => o.defaultOn !== false).map((o) => o.id);
  return defaults.length ? defaults : layer.options.map((o) => o.id);
}

/** MapLibre tile URL templates for a layer, given the hunter's picked view options. Bundled GeoJSON has none. */
export function tileUrls(layer: LayerDef, picked?: string[]): string[] {
  const source = layer.source;
  const ids = new Set(activeOptionIds(layer, picked));
  const chosen = layer.options?.filter((o) => ids.has(o.id));

  switch (source.kind) {
    case 'geojson':
      return [];

    case 'xyz':
      return source.tiles;

    case 'arcgis-export': {
      const params = new URLSearchParams({
        bboxSR: '3857',
        imageSR: '3857',
        size: '256,256',
        dpi: '96',
        format: 'png32',
        transparent: 'true',
        f: 'image',
      });
      const subIds = chosen?.some((o) => o.value != null) ? chosen.map((o) => o.value as number) : source.sublayers;
      if (subIds && subIds.length) params.set('layers', `show:${subIds.join(',')}`);
      if (source.filter) {
        const clauses = [source.filter.where];
        const optionWhere = chosen?.filter((o) => o.where).map((o) => `(${o.where})`);
        if (optionWhere && optionWhere.length) clauses.push(optionWhere.join(' OR '));
        const where = clauses.filter(Boolean).map((c) => `(${c})`).join(' AND ');
        if (where) params.set('layerDefs', JSON.stringify({ [source.filter.layer]: where }));
      }
      return [`${source.url}/export?bbox=${BBOX}&${params.toString()}`];
    }

    case 'wms': {
      const layers = chosen?.some((o) => o.value != null) ? chosen.map((o) => String(o.value)) : source.layers;
      const params = new URLSearchParams({
        service: 'WMS',
        request: 'GetMap',
        version: '1.1.1',
        layers: layers.join(','),
        styles: source.styles ?? '',
        format: 'image/png',
        transparent: 'true',
        srs: 'EPSG:3857',
        width: '256',
        height: '256',
      });
      return [`${source.url}?${params.toString()}&bbox=${BBOX}`];
    }
  }
}
