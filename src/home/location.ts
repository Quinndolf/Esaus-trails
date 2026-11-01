import type { LocationMode } from '../map/MapView';

/** One button: center on me, then the compass cone, then back to following. */
export function nextLocation(mode: LocationMode): LocationMode {
  return mode === 'free' ? 'follow' : mode === 'follow' ? 'compass' : 'follow';
}
