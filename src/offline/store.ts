import { templatesFor, type BasemapId } from '../map/basemaps';
import { countTiles, tilesIn, tileUrl, type Bounds } from './tiles';

export interface SavedArea {
  id: string;
  name: string;
  basemap: BasemapId;
  bounds: Bounds;
  minZoom: number;
  maxZoom: number;
  tiles: number;
  savedAt: string;
}

const KEY = 'esau-offline-areas';
export const MAX_TILES = 6000;

export function listAreas(): SavedArea[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

function writeAreas(areas: SavedArea[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(areas));
  } catch {
    /* storage blocked; the tiles are still cached */
  }
}

export function estimate(basemap: BasemapId, bounds: Bounds, minZoom: number, maxZoom: number): number {
  return countTiles(bounds, minZoom, maxZoom) * templatesFor(basemap).length;
}

export interface DownloadProgress {
  done: number;
  failed: number;
  total: number;
}

/** Fetch every tile for the area into its own cache. Resolves with the saved record. */
export async function saveArea(
  opts: { name: string; basemap: BasemapId; bounds: Bounds; minZoom: number; maxZoom: number },
  onProgress: (p: DownloadProgress) => void,
  signal: AbortSignal,
): Promise<SavedArea> {
  if (!('caches' in window)) throw new Error('This browser cannot store maps offline.');
  const total = estimate(opts.basemap, opts.bounds, opts.minZoom, opts.maxZoom);
  if (total > MAX_TILES) throw new Error(`That area is too big (${total} tiles). Zoom in or lower the detail.`);

  const id = `${Date.now().toString(36)}`;
  const cache = await caches.open(`esau-area-${id}`);
  const urls: string[] = [];
  for (const template of templatesFor(opts.basemap)) {
    for (const t of tilesIn(opts.bounds, opts.minZoom, opts.maxZoom)) urls.push(tileUrl(template, t));
  }

  const progress: DownloadProgress = { done: 0, failed: 0, total: urls.length };
  let next = 0;
  const worker = async () => {
    while (next < urls.length) {
      if (signal.aborted) return;
      const url = urls[next++];
      try {
        const res = await fetch(url, { mode: 'cors', signal });
        if (!res.ok) throw new Error(String(res.status));
        await cache.put(url, res);
      } catch {
        if (signal.aborted) return;
        progress.failed++;
      }
      progress.done++;
      onProgress({ ...progress });
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));

  if (signal.aborted) {
    await caches.delete(`esau-area-${id}`);
    throw new DOMException('Cancelled', 'AbortError');
  }

  const area: SavedArea = { id, ...opts, tiles: progress.done - progress.failed, savedAt: new Date().toISOString() };
  writeAreas([area, ...listAreas()]);
  return area;
}

export async function deleteArea(id: string): Promise<void> {
  if ('caches' in window) await caches.delete(`esau-area-${id}`);
  writeAreas(listAreas().filter((a) => a.id !== id));
}
