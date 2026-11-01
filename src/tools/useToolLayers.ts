import { useEffect, useRef } from 'react';
import maplibregl, { type GeoJSONSource, type Map as MLMap, type MapMouseEvent } from 'maplibre-gl';
import type { LngLat } from '../map/geo';
import { usePhotoPins } from '../photos/store';
import { ICON_COLORS, iconSvg } from './icons';
import { useTools } from './store';
import { attachHoldDrag, justDragged } from '../marks/holdDrag';
import type { Waypoint } from './types';

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
const DRAW_COLOR = '#f28c28';

const line = (coords: LngLat[], props: Record<string, unknown> = {}): GeoJSON.Feature => ({
  type: 'Feature',
  properties: props,
  geometry: { type: 'LineString', coordinates: coords },
});
const area = (coords: LngLat[], props: Record<string, unknown> = {}): GeoJSON.Feature => ({
  type: 'Feature',
  properties: props,
  geometry: { type: 'Polygon', coordinates: [[...coords, coords[0]]] },
});
const fc = (features: GeoJSON.Feature[]): GeoJSON.FeatureCollection => ({ type: 'FeatureCollection', features });

/** Draws saved shapes, tracks, the live route, the measuring draft and waypoints, and routes map taps to the active tool. */
export function useToolLayers(map: MLMap | null) {
  const { waypoints, shapes, tracks, draft, mode, recording, selectedWaypointId } = useTools();
  const markers = useRef(new Map<string, { marker: maplibregl.Marker; wp: Waypoint }>());

  // Sources and layers, once per map. They sit under the GPS dot.
  useEffect(() => {
    if (!map) return;
    const before = map.getLayer('gps-accuracy') ? 'gps-accuracy' : undefined;
    for (const id of ['tools-saved', 'tools-tracks', 'tools-live', 'tools-draft']) {
      if (!map.getSource(id)) map.addSource(id, { type: 'geojson', data: EMPTY });
    }
    const add = (spec: maplibregl.LayerSpecification) => !map.getLayer(spec.id) && map.addLayer(spec, before);
    add({ id: 'tools-saved-fill', type: 'fill', source: 'tools-saved', filter: ['==', '$type', 'Polygon'], paint: { 'fill-color': '#ffd54f', 'fill-opacity': 0.18 } });
    add({ id: 'tools-saved-line', type: 'line', source: 'tools-saved', paint: { 'line-color': '#ffd54f', 'line-width': 3 } });
    add({ id: 'tools-tracks', type: 'line', source: 'tools-tracks', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#ff4081', 'line-width': 3.5, 'line-opacity': 0.85 } });
    add({ id: 'tools-live', type: 'line', source: 'tools-live', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#ff4081', 'line-width': 4.5 } });
    add({ id: 'tools-draft-fill', type: 'fill', source: 'tools-draft', filter: ['==', '$type', 'Polygon'], paint: { 'fill-color': DRAW_COLOR, 'fill-opacity': 0.2 } });
    add({ id: 'tools-draft-line', type: 'line', source: 'tools-draft', filter: ['!=', '$type', 'Point'], paint: { 'line-color': DRAW_COLOR, 'line-width': 3, 'line-dasharray': [2, 1.5] } });
    add({ id: 'tools-draft-pts', type: 'circle', source: 'tools-draft', filter: ['==', '$type', 'Point'], paint: { 'circle-radius': 6, 'circle-color': '#fff', 'circle-stroke-color': DRAW_COLOR, 'circle-stroke-width': 3 } });
  }, [map]);

  useEffect(() => {
    const src = map?.getSource('tools-saved') as GeoJSONSource | undefined;
    src?.setData(fc(shapes.map((s) => (s.kind === 'area' ? area(s.points, { id: s.id }) : line(s.points, { id: s.id })))));
  }, [map, shapes]);

  useEffect(() => {
    const src = map?.getSource('tools-tracks') as GeoJSONSource | undefined;
    src?.setData(fc(tracks.map((t) => line(t.points.map((p) => p.lngLat), { id: t.id }))));
  }, [map, tracks]);

  useEffect(() => {
    const src = map?.getSource('tools-live') as GeoJSONSource | undefined;
    const pts = recording?.points.map((p) => p.lngLat) ?? [];
    src?.setData(pts.length > 1 ? fc([line(pts)]) : EMPTY);
  }, [map, recording]);

  useEffect(() => {
    const src = map?.getSource('tools-draft') as GeoJSONSource | undefined;
    const pts: GeoJSON.Feature[] = draft.map((p) => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: p } }));
    const shape = mode === 'draw-area' && draft.length >= 3 ? [area(draft)] : draft.length >= 2 ? [line(draft)] : [];
    src?.setData(fc([...shape, ...pts]));
  }, [map, draft, mode]);

  // Taps go to the active tool. A photo waiting for a manual drop takes precedence.
  useEffect(() => {
    if (!map) return;
    const onClick = (e: MapMouseEvent) => {
      if (usePhotoPins.getState().pending) return;
      if (useTools.getState().mode === 'none') return;
      void useTools.getState().tapMap([e.lngLat.lng, e.lngLat.lat]);
    };
    map.on('click', onClick);
    return () => void map.off('click', onClick);
  }, [map]);

  useEffect(() => {
    map?.getCanvasContainer().classList.toggle('tool-capturing', mode !== 'none');
  }, [map, mode]);

  // Waypoints as DOM markers, like photo pins.
  useEffect(() => {
    if (!map) return;
    const live = markers.current;
    const ids = new Set(waypoints.map((w) => w.id));
    for (const [id, entry] of live) {
      if (!ids.has(id)) {
        entry.marker.remove();
        live.delete(id);
      }
    }
    for (const wp of waypoints) {
      const existing = live.get(wp.id);
      if (existing && existing.wp.icon === wp.icon) {
        if (existing.wp.position !== wp.position) existing.marker.setLngLat(wp.position);
        existing.marker.getElement().setAttribute('aria-label', wp.name);
        existing.wp = wp;
        continue;
      }
      existing?.marker.remove();
      const el = document.createElement('button');
      el.type = 'button';
      el.className = `wp-marker wp-${wp.icon}`;
      el.style.setProperty('--wp-color', ICON_COLORS[wp.icon]);
      el.setAttribute('aria-label', wp.name);
      el.innerHTML = iconSvg(wp.icon);
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        if (justDragged() || useTools.getState().mode !== 'none') return;
        useTools.getState().selectWaypoint(wp.id);
      });
      const marker = new maplibregl.Marker({ element: el, anchor: wp.icon === 'x' ? 'center' : 'bottom' }).setLngLat(wp.position).addTo(map);
      attachHoldDrag(map, marker, (to) => void useTools.getState().updateWaypoint(wp.id, { position: to }));
      live.set(wp.id, { marker, wp });
    }
  }, [map, waypoints]);

  useEffect(() => {
    for (const [id, { marker }] of markers.current) marker.getElement().classList.toggle('is-selected', id === selectedWaypointId);
  }, [selectedWaypointId, waypoints]);

  useEffect(() => {
    const live = markers.current;
    return () => {
      for (const { marker } of live.values()) marker.remove();
      live.clear();
    };
  }, [map]);
}
