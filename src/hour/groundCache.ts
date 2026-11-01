import type { GroundGrid } from '../esau/types';
import type { LngLat } from '../map/geo';

/**
 * The last ground and weather read, kept on the phone so the hour bar still works in the woods with no
 * service. It is never presented as fresh: the caller says how old it is.
 */
const KEY = 'esau-ground-cache';
export const MAX_SAVED = 3;
/** Degrees: close enough that the saved ground still covers where the hunter is standing. */
const NEAR_DEG = 0.06;

interface Saved {
  savedAt: number;
  grid: GroundGrid;
}

function read(): Saved[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function saveGround(grid: GroundGrid, now = Date.now()): void {
  try {
    const rest = read().filter((s) => Math.abs(s.grid.west - grid.west) > 1e-4 || Math.abs(s.grid.south - grid.south) > 1e-4);
    localStorage.setItem(KEY, JSON.stringify([{ savedAt: now, grid }, ...rest].slice(0, MAX_SAVED)));
  } catch {
    /* storage full or blocked: the live read still worked */
  }
}

export function nearestSavedGround([lng, lat]: LngLat): Saved | null {
  let best: Saved | null = null;
  let bestD = Infinity;
  for (const s of read()) {
    const g = s.grid;
    if (!g?.elevationM) continue;
    const dx = lng - (g.west + g.east) / 2;
    const dy = lat - (g.south + g.north) / 2;
    const d = Math.hypot(dx, dy);
    if (d < NEAR_DEG && d < bestD) {
      best = s;
      bestD = d;
    }
  }
  return best;
}

export function ageLabel(savedAt: number, now = Date.now()): string {
  const min = Math.round((now - savedAt) / 60e3);
  if (min < 60) return `${Math.max(1, min)} min ago`;
  const h = Math.round(min / 60);
  return h < 24 ? `${h} hour${h > 1 ? 's' : ''} ago` : 'over a day ago';
}
