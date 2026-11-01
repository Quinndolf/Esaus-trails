import { attachHoldDrag, justDragged } from '../marks/holdDrag';
import { useEffect, useRef } from 'react';
import maplibregl, { type Map as MlMap, type MapMouseEvent } from 'maplibre-gl';
import { getPhoto } from './photoDb';
import { usePhotoPins } from './store';
import type { PhotoPin } from './types';

/**
 * Draws every photo pin on the map as a round thumbnail marker. Tapping one
 * selects it, which opens the pin sheet. The map module just calls this with
 * its map instance.
 */
export function usePhotoPinMarkers(map: MlMap | null) {
  const pins = usePhotoPins((s) => s.pins);
  const selectedPinId = usePhotoPins((s) => s.selectedPinId);
  const markers = useRef(new Map<string, { marker: maplibregl.Marker; pin: PhotoPin; url: string | null }>());

  useEffect(() => {
    if (!map) return;
    const live = markers.current;
    const ids = new Set(pins.map((p) => p.id));

    for (const [id, entry] of live) {
      if (!ids.has(id)) {
        entry.marker.remove();
        if (entry.url) URL.revokeObjectURL(entry.url);
        live.delete(id);
      }
    }

    for (const pin of pins) {
      const existing = live.get(pin.id);
      if (existing) {
        if (existing.pin.position !== pin.position) existing.marker.setLngLat(pin.position);
        existing.marker.getElement().setAttribute('aria-label', pin.name);
        existing.pin = pin;
        continue;
      }
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'photo-pin-marker';
      el.setAttribute('aria-label', pin.name);
      const img = document.createElement('span');
      img.className = 'photo-pin-marker__img';
      el.appendChild(img);
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        if (justDragged()) return;
        usePhotoPins.getState().select(pin.id);
      });
      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat(pin.position).addTo(map);
      attachHoldDrag(map, marker, (to) => void usePhotoPins.getState().updatePin(pin.id, { position: { lng: to[0], lat: to[1] } }));
      const entry = { marker, pin, url: null as string | null };
      live.set(pin.id, entry);
      void getPhoto(pin.photoId).then((photo) => {
        if (!photo || live.get(pin.id) !== entry) return;
        entry.url = URL.createObjectURL(photo.thumb ?? photo.blob);
        img.style.backgroundImage = `url("${entry.url}")`;
      });
    }
  }, [map, pins]);

  useEffect(() => {
    for (const [id, { marker }] of markers.current) {
      marker.getElement().classList.toggle('is-selected', id === selectedPinId);
    }
  }, [selectedPinId, pins]);

  useEffect(() => {
    const live = markers.current;
    return () => {
      for (const { marker, url } of live.values()) {
        marker.remove();
        if (url) URL.revokeObjectURL(url);
      }
      live.clear();
    };
  }, [map]);
}

/**
 * While a photo is waiting for a location, the next map tap drops its pin.
 * The map's own "read this spot" tap handler should skip taps while
 * `isAwaitingPinDrop()` is true so the two don't both fire.
 */
export function useManualPinDrop(map: MlMap | null) {
  const pending = usePhotoPins((s) => s.pending);

  useEffect(() => {
    if (!map || !pending) return;
    const canvas = map.getCanvasContainer();
    canvas.classList.add('photo-pin-dropping');
    const onClick = (e: MapMouseEvent) => {
      void usePhotoPins.getState().placePending({ lng: e.lngLat.lng, lat: e.lngLat.lat }, 'manual');
    };
    map.once('click', onClick);
    return () => {
      map.off('click', onClick);
      canvas.classList.remove('photo-pin-dropping');
    };
  }, [map, pending]);
}

export function isAwaitingPinDrop(): boolean {
  return usePhotoPins.getState().pending !== null;
}

/**
 * Flies the map to a pin, e.g. after picking it from the list. With
 * `aboveSheet`, the pin lands near the top of the screen so a bottom sheet
 * covering most of a phone doesn't hide it.
 */
export function flyToPin(map: MlMap, pin: PhotoPin, { aboveSheet = false } = {}) {
  const h = map.getContainer().clientHeight;
  map.flyTo({
    center: pin.position,
    zoom: Math.max(map.getZoom(), 16),
    offset: aboveSheet ? [0, -h * 0.4] : [0, 0],
  });
}
