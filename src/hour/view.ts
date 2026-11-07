import type { Map as MLMap } from 'maplibre-gl';
import { groundFits, viewBbox, type Bbox } from './ground';
import { useHour } from './store';

/** The ground Esau should read for what is on screen right now. */
export function viewGround(map: MLMap): Bbox {
  const b = map.getBounds();
  return viewBbox({ west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() });
}

/** Re-read the ground when the map has moved or zoomed to a different scale. Keeps the hour the slider is on. */
export async function ensureGroundForView(map: MLMap): Promise<void> {
  const want = viewGround(map);
  const { grid, date } = useHour.getState();
  if (grid && groundFits(grid, want)) return;
  await useHour.getState().load(want);
  const { hours, status } = useHour.getState();
  if (status === 'ready' && hours.length && date >= hours[0] && date <= hours[hours.length - 1]) useHour.getState().setDate(date);
}

/**
 * The box of map that is really on screen. When the map is turned (compass mode) the screen is a tilted
 * square on the ground, so take the box inside its four corners, never the bigger box around them.
 */
export function innerBox(corners: { lng: number; lat: number }[]): Bbox {
  // The box through the middle of each screen edge: exact when not turned or turned 45 degrees, close between.
  const mids = corners.map((c, k) => {
    const d = corners[(k + 1) % corners.length]!;
    return { lng: (c.lng + d.lng) / 2, lat: (c.lat + d.lat) / 2 };
  });
  const lngs = mids.map((m) => m.lng);
  const lats = mids.map((m) => m.lat);
  return { west: Math.min(...lngs), east: Math.max(...lngs), south: Math.min(...lats), north: Math.max(...lats) };
}

export function visibleBox(map: MLMap): Bbox {
  if (!map.getBearing() && !map.getPitch()) {
    const b = map.getBounds();
    return { west: b.getWest(), east: b.getEast(), south: b.getSouth(), north: b.getNorth() };
  }
  const { clientWidth: w, clientHeight: h } = map.getContainer();
  return innerBox([map.unproject([0, 0]), map.unproject([w, 0]), map.unproject([w, h]), map.unproject([0, h])]);
}
