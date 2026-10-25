import { useEffect, useMemo } from 'react';
import type { GeoJSONSource, ImageSource, Map as MLMap } from 'maplibre-gl';
import type { LngLat } from '../map/geo';
import { cellAt, gridCenter } from '../model/geo';
import { tracePlume } from '../model/scent';
import {
  bedPoints,
  imageCorners,
  plumePolygon,
  presencePixels,
  thermalPixels,
  thermalTicks,
  trailLines,
  windArrows,
} from './overlays';
import { useHour } from './store';

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
const BLANK_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
const IMAGES = ['hour-thermal', 'hour-presence'] as const;
const GEOJSON = ['hour-wind', 'hour-ticks', 'hour-trails', 'hour-beds', 'hour-scent'] as const;
export const HOUR_LAYER_IDS = [
  'hour-thermal',
  'hour-presence',
  'hour-trails-casing',
  'hour-trails',
  'hour-ticks',
  'hour-wind',
  'hour-scent-fill',
  'hour-scent-line',
  'hour-beds',
];

function toDataUrl(px: Uint8ClampedArray, w: number, h: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return BLANK_PNG;
  ctx.putImageData(new ImageData(px as Uint8ClampedArray<ArrayBuffer>, w, h), 0, 0);
  return canvas.toDataURL();
}

function ensureLayers(map: MLMap) {
  if (map.getSource('hour-thermal')) return;
  const before = map.getLayer('gps-accuracy') ? 'gps-accuracy' : undefined;
  const far: [number, number][] = [
    [0, 0.0001],
    [0.0001, 0.0001],
    [0.0001, 0],
    [0, 0],
  ];
  for (const id of IMAGES) map.addSource(id, { type: 'image', url: BLANK_PNG, coordinates: far as never });
  for (const id of GEOJSON) map.addSource(id, { type: 'geojson', data: EMPTY });
  const raster = { 'raster-resampling': 'linear', 'raster-fade-duration': 0 } as const;
  map.addLayer(
    { id: 'hour-thermal', type: 'raster', source: 'hour-thermal', paint: { ...raster, 'raster-opacity': 0.42 } },
    before,
  );
  map.addLayer(
    { id: 'hour-presence', type: 'raster', source: 'hour-presence', paint: { ...raster, 'raster-opacity': 0.7 } },
    before,
  );
  map.addLayer(
    {
      id: 'hour-trails-casing',
      type: 'line',
      source: 'hour-trails',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#1a1208', 'line-width': ['+', 2, ['*', 5, ['get', 'weight']]], 'line-opacity': 0.6 },
    },
    before,
  );
  map.addLayer(
    {
      id: 'hour-trails',
      type: 'line',
      source: 'hour-trails',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#f2c14e',
        'line-width': ['+', 1, ['*', 3, ['get', 'weight']]],
        'line-opacity': ['min', 1, ['+', 0.35, ['get', 'weight']]],
        'line-dasharray': [2, 1.2],
      },
    },
    before,
  );
  map.addLayer(
    {
      id: 'hour-ticks',
      type: 'line',
      source: 'hour-ticks',
      paint: {
        'line-color': ['match', ['get', 'state'], 1, '#ffb066', 3, '#7d9bff', '#9fd0ff'],
        'line-width': 1.6,
        'line-opacity': 0.9,
      },
    },
    before,
  );
  map.addLayer(
    {
      id: 'hour-wind',
      type: 'line',
      source: 'hour-wind',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': ['case', ['get', 'eddy'], '#ff7a59', '#ffffff'], 'line-width': 2, 'line-opacity': 0.85 },
    },
    before,
  );
  map.addLayer(
    {
      id: 'hour-scent-fill',
      type: 'fill',
      source: 'hour-scent',
      filter: ['==', ['geometry-type'], 'Polygon'],
      paint: { 'fill-color': '#c8f560', 'fill-opacity': 0.22 },
    },
    before,
  );
  map.addLayer(
    {
      id: 'hour-scent-line',
      type: 'line',
      source: 'hour-scent',
      filter: ['==', ['geometry-type'], 'LineString'],
      paint: { 'line-color': '#c8f560', 'line-width': 2, 'line-dasharray': [1, 1] },
    },
    before,
  );
  map.addLayer(
    {
      id: 'hour-beds',
      type: 'circle',
      source: 'hour-beds',
      paint: {
        'circle-radius': ['+', 6, ['*', 6, ['get', 'bedded']]],
        'circle-color': '#8b5a2b',
        'circle-stroke-color': '#f2c14e',
        'circle-stroke-width': 2,
        'circle-opacity': ['+', 0.45, ['*', 0.55, ['get', 'bedded']]],
      },
    },
    before,
  );
}

function setVisible(map: MLMap, on: boolean) {
  for (const id of HOUR_LAYER_IDS)
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
}

/** Paints the slider's hour on the map: thermals, deer presence, trails, beds, wind and the hunter's scent. */
export function useHourOverlays(map: MLMap | null, hunter: LngLat | null) {
  const { grid, conditions, movement, date, open, status } = useHour();
  const show = open && status === 'ready';

  const frame = useMemo(() => {
    if (!grid || !conditions || !movement) return null;
    const hc = conditions.at(date);
    const m = movement.at(hc.sun, hc.weather, hc.wind);
    const source = hunter && cellAt(grid, hunter) != null ? hunter : gridCenter(grid);
    return { hc, m, plume: tracePlume(conditions.terrain, hc.scent, source) };
  }, [grid, conditions, movement, date, hunter?.[0], hunter?.[1]]);

  useEffect(() => {
    // `map` only arrives after its style has loaded (MapView's onReady), so layers can go straight on.
    if (!map) return;
    ensureLayers(map);
    setVisible(map, show && !!frame);
    if (!show || !frame || !grid) return;
    const corners = imageCorners(grid);
    (map.getSource('hour-thermal') as ImageSource).updateImage({
      url: toDataUrl(thermalPixels(frame.hc), grid.cols, grid.rows),
      coordinates: corners,
    });
    (map.getSource('hour-presence') as ImageSource).updateImage({
      url: toDataUrl(presencePixels(frame.m), grid.cols, grid.rows),
      coordinates: corners,
    });
    (map.getSource('hour-wind') as GeoJSONSource).setData(windArrows(grid, frame.hc));
    (map.getSource('hour-ticks') as GeoJSONSource).setData(thermalTicks(grid, frame.hc));
    (map.getSource('hour-trails') as GeoJSONSource).setData(trailLines(frame.m));
    (map.getSource('hour-beds') as GeoJSONSource).setData(bedPoints(frame.m));
    (map.getSource('hour-scent') as GeoJSONSource).setData(plumePolygon(frame.plume));
  }, [map, frame, show, grid]);

  return frame;
}
