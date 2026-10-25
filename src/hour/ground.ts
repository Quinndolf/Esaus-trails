import type { GroundGrid } from '../esau/types';

export interface Bbox {
  west: number;
  south: number;
  east: number;
  north: number;
}

/** Same footprint the prototype's "Analyze this view" used: about 1.6 x 1.5 miles around the center. */
export function bboxAround([lng, lat]: [number, number]): Bbox {
  return { west: lng - 0.03, east: lng + 0.03, south: lat - 0.022, north: lat + 0.022 };
}

/** Ground grid (elevation, cover, crop, weather) from the server's /api/ground. */
export async function fetchGround(b: Bbox, opts: { signal?: AbortSignal; cells?: number } = {}): Promise<GroundGrid> {
  const cells = String(opts.cells ?? 32);
  const q = new URLSearchParams({
    west: b.west.toFixed(5),
    south: b.south.toFixed(5),
    east: b.east.toFixed(5),
    north: b.north.toFixed(5),
    cols: cells,
    rows: cells,
  });
  const res = await fetch(`/api/ground?${q}`, { signal: opts.signal });
  if (!res.ok) {
    let detail = '';
    try {
      detail = ((await res.json()) as { error?: string }).error ?? '';
    } catch {
      /* not json */
    }
    throw new Error(detail || `Couldn't read this ground (${res.status})`);
  }
  const grid = (await res.json()) as GroundGrid;
  if (!grid.elevationM?.length || grid.elevationM.length !== grid.cols * grid.rows)
    throw new Error('Ground came back incomplete');
  if (!grid.weather?.hours?.length) throw new Error('No weather for this ground');
  return grid;
}
