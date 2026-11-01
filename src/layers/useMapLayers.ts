import { useEffect, useRef } from 'react';
import type { ExpressionSpecification, GeoJSONSource, Map as MLMap, RasterSourceSpecification } from 'maplibre-gl';
import { activeOptionIds, tileUrls } from './tiles';
import type { LayerDef, LayerState } from './types';

/** Overlays sit above the basemap and below the hunter's own drawings and the GPS dot. */
function insertBefore(map: MLMap): string | undefined {
  const first = map.getStyle().layers.find((l) => l.id.startsWith('tools-') || l.id === 'gps-accuracy');
  return first?.id;
}

function key(layer: LayerDef, state: LayerState): string {
  if (layer.source.kind === 'geojson') return `geojson:${activeOptionIds(layer, state.options[layer.id]).join(',')}`;
  return tileUrls(layer, state.options[layer.id]).join('|');
}

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

// A bundled polygon layer: a fill colored by one property, thin outlines, and dashed outlines where flagged.
function addGeoJSON(map: MLMap, id: string, layer: LayerDef, picked: string[] | undefined, before: string | undefined) {
  if (layer.source.kind !== 'geojson') return;
  const { load, property, colors, dashed } = layer.source;
  map.addSource(id, { type: 'geojson', data: EMPTY, attribution: layer.attribution });
  load()
    .then((data) => (map.getSource(id) as GeoJSONSource | undefined)?.setData(data))
    .catch(() => {
      /* the layer's data did not load; it stays empty rather than throwing */
    });

  const ids = new Set(activeOptionIds(layer, picked));
  const values = layer.options?.filter((o) => ids.has(o.id) && o.value != null).map((o) => o.value as string | number);
  const filter: ExpressionSpecification | undefined = values?.length
    ? ['in', ['get', property], ['literal', values]]
    : undefined;
  const fill = ['match', ['get', property], ...Object.entries(colors).flatMap(([k, c]) => [Number.isNaN(Number(k)) ? k : Number(k), c]), '#9e9e9e'];
  const minzoom = layer.minzoom ?? 0;

  map.addLayer(
    { id, type: 'fill', source: id, minzoom, ...(filter && { filter }), paint: { 'fill-color': fill as ExpressionSpecification, 'fill-opacity': layer.opacity ?? 0.5 } },
    before,
  );
  map.addLayer(
    { id: `${id}-line`, type: 'line', source: id, minzoom, ...(filter && { filter }), paint: { 'line-color': '#3e2723', 'line-width': 1, 'line-opacity': 0.7 } },
    before,
  );
  if (dashed) {
    const flagged: ExpressionSpecification = ['==', ['get', dashed], true];
    map.addLayer(
      {
        id: `${id}-dashed`,
        type: 'line',
        source: id,
        minzoom,
        filter: filter ? ['all', filter, flagged] : flagged,
        paint: { 'line-color': '#3e2723', 'line-width': 2.5, 'line-dasharray': [2, 1.5] },
      },
      before,
    );
  }
}

/** Keep the map's overlay rasters in step with the layer toggles and view options. */
export function useMapLayers(map: MLMap | null, layers: LayerDef[], state: LayerState) {
  // Tile URL each overlay was added with, so a change of view options rebuilds just that source.
  const added = useRef(new Map<string, string>());

  useEffect(() => {
    if (!map) return;
    const before = insertBefore(map);

    for (const layer of layers) {
      const id = `ovl-${layer.id}`;
      const want = !!state.on[layer.id] && !layer.unavailable;
      const have = added.current.get(layer.id);
      const next = want ? key(layer, state) : undefined;

      if (have && have !== next) {
        for (const l of [id, `${id}-line`, `${id}-dashed`]) if (map.getLayer(l)) map.removeLayer(l);
        if (map.getSource(id)) map.removeSource(id);
        added.current.delete(layer.id);
      }
      if (next && have !== next) {
        const tiles = next.split('|');
        // An empty view-option pick means "show nothing" rather than "show everything".
        const picked = state.options[layer.id];
        if (layer.options && picked && picked.length === 0) continue;
        if (layer.source.kind === 'geojson') {
          addGeoJSON(map, id, layer, picked, before);
          added.current.set(layer.id, next);
          continue;
        }
        const source: RasterSourceSpecification = {
          type: 'raster',
          tiles,
          tileSize: layer.source.kind === 'xyz' ? (layer.source.tileSize ?? 256) : 256,
          attribution: layer.attribution,
          minzoom: layer.minzoom,
          maxzoom: layer.maxzoom ?? 19,
        };
        map.addSource(id, source);
        map.addLayer(
          {
            id,
            type: 'raster',
            source: id,
            minzoom: layer.minzoom ?? 0,
            paint: { 'raster-opacity': layer.opacity ?? 0.75, 'raster-fade-duration': 150 },
          },
          before,
        );
        added.current.set(layer.id, next);
      }
    }
  }, [map, layers, state]);
}
