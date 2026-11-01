import type maplibregl from 'maplibre-gl';
import type { LngLat } from '../map/geo';

export const HOLD_MS = 500;
export const MOVE_SLOP_PX = 8;

/** Pure rule for the gesture: hold still for HOLD_MS to pick a marker up; moving first means pan or tap. */
export function holdDragDecision(s: { heldMs: number; movedPx: number }): 'wait' | 'drag' | 'cancel' {
  if (s.movedPx > MOVE_SLOP_PX) return 'cancel';
  return s.heldMs >= HOLD_MS ? 'drag' : 'wait';
}

/** Marker taps right after a drag must not open the marker's sheet. */
let suppressUntil = 0;
export const justDragged = () => Date.now() < suppressUntil;

/**
 * Press and hold a map marker, then drag it to fix its spot. Releasing saves the new position through
 * `commit`. Panning the map and tapping the marker behave as before.
 */
export function attachHoldDrag(map: maplibregl.Map, marker: maplibregl.Marker, commit: (to: LngLat) => void): void {
  const el = marker.getElement();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let start: { x: number; y: number; id: number } | null = null;
  let dragging = false;
  let origin: [number, number] | null = null;

  const lngLatAt = (e: PointerEvent): LngLat => {
    const r = map.getCanvas().getBoundingClientRect();
    const p = map.unproject([e.clientX - r.left, e.clientY - r.top]);
    return [p.lng, p.lat];
  };

  const finish = (e: PointerEvent | null, save: boolean) => {
    if (timer) clearTimeout(timer);
    timer = null;
    if (dragging) {
      dragging = false;
      suppressUntil = Date.now() + 400;
      el.classList.remove('is-dragging');
      map.dragPan.enable();
      if (save && e) commit(lngLatAt(e));
      else if (origin) marker.setLngLat(origin);
    }
    start = null;
  };

  el.addEventListener('pointerdown', (e) => {
    start = { x: e.clientX, y: e.clientY, id: e.pointerId };
    timer = setTimeout(() => {
      dragging = true;
      const ll = marker.getLngLat();
      origin = [ll.lng, ll.lat];
      el.classList.add('is-dragging');
      map.dragPan.disable();
      el.setPointerCapture?.(start!.id);
      navigator.vibrate?.(30);
    }, HOLD_MS);
  });
  el.addEventListener('pointermove', (e) => {
    if (!start) return;
    if (dragging) {
      marker.setLngLat(lngLatAt(e));
      return;
    }
    const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y);
    if (holdDragDecision({ heldMs: 0, movedPx: moved }) === 'cancel') finish(null, false);
  });
  el.addEventListener('pointerup', (e) => finish(e, true));
  el.addEventListener('pointercancel', (e) => finish(e, false));
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}
