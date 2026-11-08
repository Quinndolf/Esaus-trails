import { useEffect } from 'react';
import { create } from 'zustand';
import type { GeoJSONSource, Map as MLMap } from 'maplibre-gl';
import { useEsau } from '../esau/ui/store';
import type { LngLat } from '../model/geo';
import './home.css';

/** Whether the suggested walk in is drawn. Off at every start, so the map stays clean until asked. */
export const useRouteToggle = create<{ show: boolean; toggle(): void }>((set, get) => ({
  show: false,
  toggle: () => set({ show: !get().show }),
}));

/** The "Suggested route" on/off button. Only there when Esau has a walk in to suggest. */
export function RouteToggle() {
  const route = useEsau((s) => s.analysis?.route);
  const { show, toggle } = useRouteToggle();
  if (!route) return null;
  return (
    <button className={`pill-btn route-pill ${show ? 'is-on' : ''}`} data-testid="route-toggle" aria-pressed={show} onClick={toggle}>
      Suggested route {show ? 'on' : 'off'}
      {show && <span className="route-pill-yd"> · {Math.round(route.yards / 10) * 10} yd</span>}
    </button>
  );
}

const SRC = 'esau-route';
const empty = { type: 'FeatureCollection' as const, features: [] };

/** The walk in as a GeoJSON line, with its end marked. */
export function routeFeatures(path: LngLat[]) {
  return {
    type: 'FeatureCollection' as const,
    features: [
      { type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: path } },
      { type: 'Feature' as const, properties: { end: true }, geometry: { type: 'Point' as const, coordinates: path[path.length - 1]! } },
    ],
  };
}

/** Draws the suggested walk in on the map while the button is on. */
export function useRouteLine(map: MLMap | null) {
  const route = useEsau((s) => s.analysis?.route);
  const show = useRouteToggle((s) => s.show);
  useEffect(() => {
    if (!map) return;
    if (!map.getSource(SRC)) {
      map.addSource(SRC, { type: 'geojson', data: empty });
      map.addLayer({ id: `${SRC}-casing`, type: 'line', source: SRC, filter: ['==', '$type', 'LineString'], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': 7, 'line-opacity': 0.9 } });
      map.addLayer({ id: `${SRC}-line`, type: 'line', source: SRC, filter: ['==', '$type', 'LineString'], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#e2711d', 'line-width': 4, 'line-dasharray': [1.5, 1.2] } });
      map.addLayer({ id: `${SRC}-end`, type: 'circle', source: SRC, filter: ['==', '$type', 'Point'], paint: { 'circle-radius': 6, 'circle-color': '#e2711d', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 } });
    }
    (map.getSource(SRC) as GeoJSONSource).setData(show && route ? routeFeatures(route.path) : empty);
  }, [map, route, show]);
}
