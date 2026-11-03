import { useEffect, useRef } from 'react';
import maplibregl, { type Map as MLMap } from 'maplibre-gl';
import { yardsBetween } from '../model/geo';
import { useEsau } from '../esau/ui/store';
import { rangeNote } from './range';
import { useSpotWhy } from './SpotWhyCard';
import './home.css';

/** Esau's top sit spots as numbered dashed markers, clearly different from the hunter's own marks. Tap one for his reasons. */
export function useSitSpotMarkers(map: MLMap | null) {
  const spots = useEsau((s) => s.analysis?.spots);
  const live = useRef<maplibregl.Marker[]>([]);
  useEffect(() => {
    if (!map) return;
    live.current.forEach((m) => m.remove());
    live.current = (spots ?? []).map((s) => {
      // A button: tap it to read why Esau picked this spot.
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'sit-marker';
      el.textContent = String(s.rank);
      el.setAttribute('aria-label', `Why Esau picked sit spot ${s.rank}`);
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        useSpotWhy.getState().show(s.rank);
      });
      return new maplibregl.Marker({ element: el }).setLngLat(s.lngLat).addTo(map);
    });
    return () => live.current.forEach((m) => m.remove());
  }, [map, spots]);
}

/** Big banner (out of season, illegal, wrong wind) visible on the map; the Esau sheet shows them when it is open. */
export function AdvisoryBanner() {
  const open = useEsau((s) => s.open);
  const advisories = useEsau((s) => s.analysis?.advisories);
  if (open || !advisories?.length) return null;
  return (
    <div className="advisory-stack" data-testid="advisory-banner">
      {advisories.map((a) => (
        <div key={a.kind} className={`advisory is-${a.kind}`} role="alert">
          <strong>{a.title}</strong>
          <span>{a.detail}</span>
        </div>
      ))}
    </div>
  );
}

/** How far the chosen sit spot is from the hunter, against the weapon's working range. */
export function RangePill() {
  const sit = useEsau((s) => s.sit);
  const hunter = useEsau((s) => s.hunter);
  const weapon = useEsau((s) => s.weapon);
  if (!sit || !hunter) return null;
  const yards = yardsBetween([hunter.lng, hunter.lat], [sit.lng, sit.lat]);
  return (
    <div className="range-pill" data-testid="range-pill">
      {rangeNote(weapon, yards)}
    </div>
  );
}
