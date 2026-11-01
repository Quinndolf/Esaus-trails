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
  /** Tiles that would not download. The area works but has gaps. */
  failed?: number;
  /** Names of the map layers saved with it (missing on areas saved before layers could go offline). */
  overlays?: string[];
}

/** A map layer to save alongside the basemap, limited to the zooms it actually draws at. */
export interface OfflineOverlay {
  id: string;
  name: string;
  templates: string[];
  minzoom?: number;
  maxzoom?: number;
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

interface Job {
  templates: string[];
  minZoom: number;
  maxZoom: number;
}

// The basemap at every detail level, then each layer clipped to its own zooms. MapLibre stretches a
// layer's top zoom when you zoom past it, so tiles above a layer's maxzoom are never asked for.
function jobs(basemap: BasemapId, minZoom: number, maxZoom: number, overlays: OfflineOverlay[]): Job[] {
  const out: Job[] = [{ templates: templatesFor(basemap), minZoom, maxZoom }];
  for (const o of overlays) {
    const lo = Math.max(minZoom, o.minzoom ?? 0);
    const hi = Math.min(maxZoom, o.maxzoom ?? maxZoom);
    if (lo <= hi) out.push({ templates: o.templates, minZoom: lo, maxZoom: hi });
  }
  return out;
}

export function estimate(basemap: BasemapId, bounds: Bounds, minZoom: number, maxZoom: number, overlays: OfflineOverlay[] = []): number {
  return jobs(basemap, minZoom, maxZoom, overlays).reduce(
    (n, j) => n + countTiles(bounds, j.minZoom, j.maxZoom) * j.templates.length,
    0,
  );
}

export interface DownloadProgress {
  done: number;
  failed: number;
  total: number;
}

/** Fetch every tile for the area into its own cache. Resolves with the saved record. */
export async function saveArea(
  opts: { name: string; basemap: BasemapId; bounds: Bounds; minZoom: number; maxZoom: number; overlays?: OfflineOverlay[] },
  onProgress: (p: DownloadProgress) => void,
  signal: AbortSignal,
): Promise<SavedArea> {
  if (!('caches' in window)) throw new Error('This browser cannot store maps offline.');
  const { overlays = [], ...rest } = opts;
  const total = estimate(opts.basemap, opts.bounds, opts.minZoom, opts.maxZoom, overlays);
  if (total > MAX_TILES) throw new Error(`That area is too big (${total} tiles). Zoom in or lower the detail.`);

  // Ask the browser not to clear the saved tiles when the phone runs low on space.
  try {
    await navigator.storage?.persist?.();
  } catch {
    /* best effort */
  }

  const id = `${Date.now().toString(36)}`;
  const cache = await caches.open(`esau-area-${id}`);
  const urls: string[] = [];
  for (const job of jobs(opts.basemap, opts.minZoom, opts.maxZoom, overlays)) {
    for (const template of job.templates) {
      for (const t of tilesIn(opts.bounds, job.minZoom, job.maxZoom)) urls.push(tileUrl(template, t));
    }
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

  const area: SavedArea = {
    id,
    ...rest,
    tiles: progress.done - progress.failed,
    failed: progress.failed,
    savedAt: new Date().toISOString(),
    overlays: overlays.map((o) => o.name),
  };
  writeAreas([area, ...listAreas()]);
  return area;
}

export async function deleteArea(id: string): Promise<void> {
  if ('caches' in window) await caches.delete(`esau-area-${id}`);
  writeAreas(listAreas().filter((a) => a.id !== id));
}
