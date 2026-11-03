import { useEffect, useRef } from 'react';
import maplibregl, { type Map as MLMap } from 'maplibre-gl';
import { MOCK_HOLD_MS, mockHoldDecision, useMock } from './store';

/**
 * Press and hold open map to pretend you're standing there; the scent drift then draws from that spot.
 * Only the bare map starts it, so holding a marker (hold-to-drag) and the location button keep their own meaning.
 * `allowed` lets the shell veto it, e.g. while a sheet or tool owns the touch.
 */
export function useMockHold(map: MLMap | null, allowed: () => boolean) {
  const ok = useRef(allowed);
  ok.current = allowed;
  const pos = useMock((s) => s.pos);

  useEffect(() => {
    if (!map) return;
    const el = map.getCanvasContainer();
    let timer: ReturnType<typeof setTimeout> | null = null;
    let start: { x: number; y: number; id: number } | null = null;
    const stop = () => {
      if (timer) clearTimeout(timer);
      timer = null;
      start = null;
    };
    const down = (e: PointerEvent) => {
      stop();
      if (!e.isPrimary || e.target !== map.getCanvas() || !ok.current()) return;
      start = { x: e.clientX, y: e.clientY, id: e.pointerId };
      timer = setTimeout(() => {
        if (!start) return;
        const r = map.getCanvas().getBoundingClientRect();
        const p = map.unproject([start.x - r.left, start.y - r.top]);
        navigator.vibrate?.(30);
        useMock.getState().drop([p.lng, p.lat]);
        stop();
      }, MOCK_HOLD_MS);
    };
    const move = (e: PointerEvent) => {
      if (!start || e.pointerId !== start.id) return;
      if (mockHoldDecision({ heldMs: 0, movedPx: Math.hypot(e.clientX - start.x, e.clientY - start.y) }) === 'cancel') stop();
    };
    const hold = (e: Event) => {
      if (start) e.preventDefault(); // no phone context menu while holding
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', stop);
    el.addEventListener('pointercancel', stop);
    el.addEventListener('contextmenu', hold);
    return () => {
      stop();
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', stop);
      el.removeEventListener('pointercancel', stop);
      el.removeEventListener('contextmenu', hold);
    };
  }, [map]);

  // The held spot: an orange ring, clearly not the blue GPS dot.
  useEffect(() => {
    if (!map || !pos) return;
    const el = document.createElement('div');
    el.className = 'mock-marker';
    el.setAttribute('aria-label', 'Pretend position');
    const m = new maplibregl.Marker({ element: el }).setLngLat(pos).addTo(map);
    return () => void m.remove();
  }, [map, pos]);
}
