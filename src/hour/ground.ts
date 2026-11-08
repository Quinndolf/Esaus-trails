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

const MI_PER_DEG_LAT = 69;
/** Esau reads what you're looking at, but never less than ~200 acres or more than a few square miles: what a hunter can walk in a couple of hours. */
export const MIN_SIDE_MI = 0.6;
export const MAX_SIDE_MI = 2;

/** The ground to read for a map view: the visible box, clamped to walkable size around its center. */
export function viewBbox(view: Bbox): Bbox {
  const lat = (view.south + view.north) / 2;
  const lng = (view.west + view.east) / 2;
  const miPerLng = MI_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
  const clamp = (v: number) => Math.min(MAX_SIDE_MI, Math.max(MIN_SIDE_MI, v));
  const halfLat = clamp((view.north - view.south) * MI_PER_DEG_LAT) / MI_PER_DEG_LAT / 2;
  const halfLng = clamp((view.east - view.west) * miPerLng) / miPerLng / 2;
  return { west: lng - halfLng, east: lng + halfLng, south: lat - halfLat, north: lat + halfLat };
}

/** How far a hunter on foot works from the middle of the screen: the hunt area is at most this wide and tall. */
export const REACH_MI = 1;

/**
 * The part of the screen a hunter can actually walk and hunt: the screen itself, or when zoomed out wider than
 * REACH_MI, a REACH_MI box at its middle. Trails, beds, sit spots and Esau's talk all stay inside it.
 */
export function huntBox(view: Bbox): Bbox {
  const lat = (view.south + view.north) / 2;
  const lng = (view.west + view.east) / 2;
  const halfLat = REACH_MI / MI_PER_DEG_LAT / 2;
  const halfLng = REACH_MI / (MI_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180)) / 2;
  return {
    west: Math.max(view.west, lng - halfLng),
    east: Math.min(view.east, lng + halfLng),
    south: Math.max(view.south, lat - halfLat),
    north: Math.min(view.north, lat + halfLat),
  };
}

/** Is a loaded grid still the right read for this view? Same ground (center inside it) and about the same scale. */
export function groundFits(grid: Bbox, want: Bbox): boolean {
  const cx = (want.west + want.east) / 2;
  const cy = (want.south + want.north) / 2;
  const inside = cx > grid.west && cx < grid.east && cy > grid.south && cy < grid.north;
  const ratio = (want.north - want.south) / (grid.north - grid.south);
  return inside && ratio > 0.7 && ratio < 1.4;
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
