import type { GroundGrid, LatLng } from '../types';

const STORE_KEY = 'esau-ground-v1';
const KEEP = 6;
const FRESH_MS = 60 * 60e3;

let grids: GroundGrid[] | null = null;

function load(): GroundGrid[] {
  if (grids) return grids;
  try {
    grids = JSON.parse(localStorage.getItem(STORE_KEY) ?? '[]') as GroundGrid[];
  } catch {
    grids = [];
  }
  return grids;
}

function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(load().slice(0, KEEP)));
  } catch {
    // Full or blocked storage only costs the offline copy.
  }
}

/** True when the spot sits well inside the grid, so the read has ground around it on every side. */
export function covers(g: GroundGrid, p: LatLng, margin = 0.2): boolean {
  const dx = (g.east - g.west) * margin;
  const dy = (g.north - g.south) * margin;
  return p.lng > g.west + dx && p.lng < g.east - dx && p.lat > g.south + dy && p.lat < g.north - dy;
}

function fresh(g: GroundGrid, now = Date.now()): boolean {
  const first = g.weather.hours[0];
  return !!first && now - Date.parse(first.at) < FRESH_MS;
}

/**
 * Ground for a tapped spot: a fresh cached grid that covers it, else the server,
 * else (no signal) any cached grid that covers it, even with an old forecast.
 */
export async function groundFor(spot: LatLng, endpoint = '/api/ground'): Promise<GroundGrid> {
  const cached = load().filter((g) => covers(g, spot));
  const hit = cached.find((g) => fresh(g));
  if (hit) return hit;
  try {
    const res = await fetch(`${endpoint}?lat=${spot.lat.toFixed(5)}&lng=${spot.lng.toFixed(5)}`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error ?? `Couldn't read the ground here (${res.status}).`);
    const grid = body as GroundGrid;
    grids = [grid, ...load().filter((g) => g !== grid)].slice(0, KEEP);
    save();
    return grid;
  } catch (err) {
    const stale = cached[0];
    if (stale) return { ...stale, notes: [...(stale.notes ?? []), 'No signal: this is ground and weather saved earlier.'] };
    throw err instanceof TypeError ? new Error("No signal, and this ground isn't saved on the phone yet.") : err;
  }
}
