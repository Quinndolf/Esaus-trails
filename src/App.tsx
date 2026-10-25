import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { buildStyle } from './map/basemaps';

// Placeholder shell: a full-screen satellite map. Phase 1 replaces this with GPS, controls and sheets.
export function App() {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!el.current) return;
    const map = new maplibregl.Map({ container: el.current, style: buildStyle('satellite'), center: [-85.3, 37.6], zoom: 12 });
    return () => map.remove();
  }, []);
  return <div ref={el} className="map" />;
}
