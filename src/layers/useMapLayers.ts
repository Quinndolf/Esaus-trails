import { useEffect, useRef } from 'react';
import type { Map as MLMap, RasterSourceSpecification } from 'maplibre-gl';
import { tileUrls } from './tiles';
import type { LayerDef, LayerState } from './types';

/** Overlays sit above the basemap and below the hunter's own drawings and the GPS dot. */
function insertBefore(map: MLMap): string | undefined {
  const first = map.getStyle().layers.find((l) => l.id.startsWith('tools-') || l.id === 'gps-accuracy');
  return first?.id;
}

function key(layer: LayerDef, state: LayerState): string {
  return tileUrls(layer, state.options[layer.id]).join('|');
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
        if (map.getLayer(id)) map.removeLayer(id);
        if (map.getSource(id)) map.removeSource(id);
        added.current.delete(layer.id);
      }
      if (next && have !== next) {
        const tiles = next.split('|');
        // An empty view-option pick means "show nothing" rather than "show everything".
        const picked = state.options[layer.id];
        if (layer.options && picked && picked.length === 0) continue;
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
