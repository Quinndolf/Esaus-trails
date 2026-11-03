import { useEffect, useRef } from 'react';
import maplibregl, { type Map as MlMap, type MapMouseEvent } from 'maplibre-gl';
import type { EsauMark } from '../types';
import { useEsau } from './store';
import { panShiftAboveSheet } from '../../map/geo';

/** Share of the screen Esau's collapsed panel covers (matches `.esau-panel` max-height: 52dvh). */
const PANEL_COVER = 0.52;

const MARK_LABEL: Record<EsauMark['kind'], string> = {
  bedding: 'Bed',
  feeding: 'Feed',
  travel: 'Trail',
  stand: 'Stand',
  approach: 'Walk in',
  avoid: 'Stay off',
};

/**
 * Wires Esau into the map: a tap reads that spot (unless another tool owns the tap),
 * and his marks and the tapped spot are drawn as markers.
 * `shouldSkip` lets the shell veto a tap, e.g. while a photo pin is waiting to be placed.
 */
export function useEsauMap(map: MlMap | null, shouldSkip: () => boolean) {
  const skip = useRef(shouldSkip);
  skip.current = shouldSkip;
  const spot = useEsau((s) => s.spot);
  const reply = useEsau((s) => s.reply);

  useEffect(() => {
    if (!map) return;
    const onClick = (e: MapMouseEvent) => {
      if (skip.current()) return;
      void useEsau.getState().tapSpot({ lat: e.lngLat.lat, lng: e.lngLat.lng });
    };
    map.on('click', onClick);
    return () => void map.off('click', onClick);
  }, [map]);

  // Tapped spot: a white ring, like onX's dropped read.
  useEffect(() => {
    if (!map || !spot) return;
    const el = document.createElement('div');
    el.className = 'esau-spot-marker';
    const m = new maplibregl.Marker({ element: el }).setLngLat([spot.lng, spot.lat]).addTo(map);
    // Esau's panel covers the lower half; if the tap landed under it, slide the map so the ring stays in view.
    const h = map.getContainer().clientHeight;
    const dy = h ? panShiftAboveSheet(map.project([spot.lng, spot.lat]).y, h, PANEL_COVER) : 0;
    if (dy) map.panBy([0, dy], { duration: 300 });
    return () => void m.remove();
  }, [map, spot]);

  useEffect(() => {
    if (!map || !reply?.marks.length) return;
    const ms = reply.marks.map((mark) => {
      const el = document.createElement('div');
      el.className = `esau-mark esau-mark--${mark.kind}`;
      el.title = mark.label;
      el.innerHTML = `<span class="esau-mark__dot"></span><span class="esau-mark__label"></span>`;
      el.querySelector('.esau-mark__label')!.textContent = `${MARK_LABEL[mark.kind]}: ${mark.label}`;
      return new maplibregl.Marker({ element: el, anchor: 'left' }).setLngLat([mark.lng, mark.lat]).addTo(map);
    });
    return () => ms.forEach((m) => m.remove());
  }, [map, reply]);
}
