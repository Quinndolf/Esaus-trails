import { useEffect, useRef, useState } from 'react';
import maplibregl, { type GeoJSONSource, type Map as MLMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { BASEMAP_LAYERS, RASTER_SOURCES, buildStyle, type BasemapId, type RasterSourceId } from './basemaps';
import { circleRing, coneRing, type LngLat } from './geo';
import type { Fix } from './useGeolocation';

export type LocationMode = 'free' | 'follow' | 'compass';

interface Props {
  basemap: BasemapId;
  fix: Fix | null;
  heading: number | null;
  mode: LocationMode;
  initialCenter: LngLat;
  initialZoom: number;
  onReady: (map: MLMap) => void;
  onUserMove: () => void;
}

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
const CONE_PIXELS = 120;
const CONE_SPREAD = 50;

function polygon(ring: LngLat[]): GeoJSON.Feature {
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } };
}

export function MapView({ basemap, fix, heading, mode, initialCenter, initialZoom, onReady, onUserMove }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const loaded = useRef(false);
  const [zoomTick, setZoomTick] = useState(0);
  const latest = useRef({ onUserMove });
  latest.current = { onUserMove };

  useEffect(() => {
    if (!el.current) return;
    const map = new maplibregl.Map({
      container: el.current,
      style: buildStyle(basemap),
      center: initialCenter,
      zoom: initialZoom,
      maxZoom: 19,
      dragRotate: false,
      pitchWithRotate: false,
      attributionControl: false,
    });
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'top-right');
    map.touchZoomRotate.disableRotation();
    mapRef.current = map;

    // Any drag or pinch by the hunter drops follow mode, like onX.
    const userMove = (e: { originalEvent?: unknown }) => {
      if (e.originalEvent) latest.current.onUserMove();
    };
    map.on('dragstart', userMove);
    map.on('zoomstart', (e) => {
      if (e.originalEvent && (e.originalEvent as TouchEvent).touches?.length > 1) latest.current.onUserMove();
    });

    map.on('zoomend', () => setZoomTick((n) => n + 1));

    // MapLibre pops the credits open whenever a layer adds new ones. Keep them collapsed so they
    // never cover the bearing pill; the (i) button still opens them.
    const collapseCredits = () =>
      el.current?.querySelector('.maplibregl-compact-show')?.classList.remove('maplibregl-compact-show');
    map.on('sourcedata', (e) => {
      if (e.sourceDataType === 'metadata') collapseCredits();
    });
    map.once('idle', collapseCredits);

    map.once('style.load', () => {
      map.addSource('gps-accuracy', { type: 'geojson', data: EMPTY });
      map.addSource('gps-cone', { type: 'geojson', data: EMPTY });
      map.addSource('gps-dot', { type: 'geojson', data: EMPTY });
      map.addLayer({
        id: 'gps-accuracy',
        type: 'fill',
        source: 'gps-accuracy',
        paint: { 'fill-color': '#2f8cff', 'fill-opacity': 0.14, 'fill-outline-color': '#2f8cff' },
      });
      map.addLayer({
        id: 'gps-cone',
        type: 'fill',
        source: 'gps-cone',
        paint: { 'fill-color': '#2f8cff', 'fill-opacity': 0.32 },
      });
      map.addLayer({
        id: 'gps-dot-halo',
        type: 'circle',
        source: 'gps-dot',
        paint: { 'circle-radius': 10, 'circle-color': '#ffffff', 'circle-blur': 0.15 },
      });
      map.addLayer({
        id: 'gps-dot',
        type: 'circle',
        source: 'gps-dot',
        paint: { 'circle-radius': 7, 'circle-color': '#2f8cff' },
      });
      loaded.current = true;
      // Handle for browser tests and debugging from the console.
      (window as unknown as { __esauMap?: MLMap }).__esauMap = map;
      onReady(map);
    });

    return () => {
      loaded.current = false;
      map.remove();
      mapRef.current = null;
    };
    // The map is created once; props below are pushed in by the effects that follow.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Basemap: flip visibility of the raster layers that make up each view.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      for (const id of Object.keys(RASTER_SOURCES) as RasterSourceId[]) {
        map.setLayoutProperty(`base-${id}`, 'visibility', BASEMAP_LAYERS[basemap].includes(id) ? 'visible' : 'none');
      }
    };
    if (map.isStyleLoaded()) apply();
    else map.once('style.load', apply);
  }, [basemap]);

  // GPS dot, accuracy ring and (in compass mode) the sight cone.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded.current) return;
    const src = (id: string) => map.getSource(id) as GeoJSONSource | undefined;
    if (!fix) {
      src('gps-dot')?.setData(EMPTY);
      src('gps-accuracy')?.setData(EMPTY);
      src('gps-cone')?.setData(EMPTY);
      return;
    }
    src('gps-dot')?.setData({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: fix.lngLat } });
    src('gps-accuracy')?.setData(polygon(circleRing(fix.lngLat, Math.min(fix.accuracy, 500))));
    // Keep the cone a steady size on screen at any zoom.
    const metersPerPixel = (40075016.7 * Math.cos((fix.lngLat[1] * Math.PI) / 180)) / (512 * 2 ** map.getZoom());
    src('gps-cone')?.setData(
      mode === 'compass' && heading != null
        ? polygon(coneRing(fix.lngLat, heading, CONE_SPREAD, metersPerPixel * CONE_PIXELS))
        : EMPTY,
    );
  }, [fix, heading, mode, zoomTick]);

  // Camera: follow keeps the dot centered; compass also turns the map heading-up.
  // The first fix, or re-centering from far out, brings the hunter in close.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !fix || mode === 'free') return;
    const zoom = map.getZoom() < 14 ? 16 : map.getZoom();
    const bearing = mode === 'compass' ? (heading ?? map.getBearing()) : 0;
    map.easeTo({ center: fix.lngLat, zoom, bearing, duration: mode === 'compass' ? 250 : 400 });
  }, [fix, heading, mode]);

  useEffect(() => {
    const map = mapRef.current;
    if (map && mode === 'free' && map.getBearing() !== 0) map.easeTo({ bearing: 0, duration: 300 });
  }, [mode]);

  return <div ref={el} className="map" data-testid="map" />;
}
