import { ALL_LAYERS } from './registry';
import { tileUrls } from './tiles';
import type { LayerDef, LayerState } from './types';
import type { OfflineOverlay } from '../offline/store';

/**
 * The layers that are on right now, ready to save with an offline area. Live layers like radar stay out,
 * and so do bundled GeoJSON layers, which already work with no signal.
 */
export function offlineOverlays(state: LayerState, layers: LayerDef[] = ALL_LAYERS): OfflineOverlay[] {
  return layers
    // An empty view-option pick draws nothing on the map, so there is nothing to save either.
    .filter((l) => state.on[l.id] && !l.live && !l.unavailable && !(l.options && state.options[l.id]?.length === 0))
    .map((l) => ({ id: l.id, name: l.name, templates: tileUrls(l, state.options[l.id]), minzoom: l.minzoom, maxzoom: l.maxzoom }))
    .filter((o) => o.templates.length > 0);
}
