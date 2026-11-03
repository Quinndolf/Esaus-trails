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
