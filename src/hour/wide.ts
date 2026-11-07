import { create } from 'zustand';
import type { GroundGrid } from '../esau/types';
import { coverClass } from '../esau/landcover';
import { compassWord, insideBounds, yardsBetween, bearingBetween, cellCenter, type Bounds, type LngLat } from '../model/geo';
import type { ConditionsModel } from '../model/conditions';
import { conditionsForGrid } from '../model/esau';
import { createMovementModel, type Bed, type MovementModel, type Trail } from '../model/movement';
import { fetchGround } from './ground';

/**
 * The wide read: miles of country around what's on screen, on a coarser grid. Esau uses it to see where
 * deer come from (bedding and travel corridors beyond the screen) while his sit picks stay on screen.
 */

const MI_PER_DEG_LAT = 69;
/** The wide read is three screens across, never under 3 miles or over 6. */
export const WIDE_MIN_MI = 3;
export const WIDE_MAX_MI = 6;
export const WIDE_CELLS = 48;
/** Corridors from the wide read count for less than trails read on the fine grid. */
export const CORRIDOR_WEIGHT = 0.6;

export function wideBox(view: Bounds): Bounds {
  const lat = (view.south + view.north) / 2;
  const lng = (view.west + view.east) / 2;
  const miPerLng = MI_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
  const side = (mi: number) => Math.min(WIDE_MAX_MI, Math.max(WIDE_MIN_MI, mi * 3));
  const halfLat = side((view.north - view.south) * MI_PER_DEG_LAT) / MI_PER_DEG_LAT / 2;
  const halfLng = side((view.east - view.west) * miPerLng) / miPerLng / 2;
  return { west: lng - halfLng, east: lng + halfLng, south: lat - halfLat, north: lat + halfLat };
}

/** The parts of the wide read's trails that run through `box` (the fine grid), as lighter trails. */
export function corridorsIn(trails: Trail[], box: Bounds): Trail[] {
  const out: Trail[] = [];
  for (const t of trails) {
    let run: LngLat[] = [];
    const flush = () => {
      if (run.length >= 2) out.push({ coordinates: run, weight: t.weight * CORRIDOR_WEIGHT });
      run = [];
    };
    for (const p of t.coordinates) {
      if (insideBounds(box, p)) run.push(p);
      else flush();
    }
    flush();
  }
  return out;
}

const center = (b: Bounds): LngLat => [(b.west + b.east) / 2, (b.south + b.north) / 2];

function coverWord(code: number): string | null {
  const c = coverClass(code);
  if (c.water) return 'water';
  if (c.developed) return 'houses and roads';
  if (c.woody) return 'woods';
  if (code === 82) return 'crop fields';
  if (c.open) return 'open fields and pasture';
  return null;
}

/** Edge of the screen a corridor crosses into it on, as a compass word from the screen's center. */
function entrySide(t: Trail, view: Bounds): string | null {
  const cs = t.coordinates;
  for (let k = 1; k < cs.length; k++) {
    const a = insideBounds(view, cs[k - 1]!), b = insideBounds(view, cs[k]!);
    if (a !== b) return compassWord(bearingBetween(center(view), a ? cs[k]! : cs[k - 1]!));
  }
  return null;
}

/**
 * A few plain lines about the country around the screen for Esau: what lies each way, where deer likely
 * bed beyond the screen, and which sides travel corridors come in from. Land only; nothing of the hunter's.
 */
export function wideSummary(grid: GroundGrid, move: { beds: Bed[]; trails: Trail[] }, view: Bounds): string[] {
  const c = center(view);
  const sectors = new Map<string, Map<string, number>>();
  for (let i = 0; i < grid.cols * grid.rows; i++) {
    const p = cellCenter(grid, i) as LngLat;
    if (insideBounds(view, p)) continue;
    const word = coverWord(grid.cover[i] ?? 0);
    if (!word) continue;
    const dir = compassWord(bearingBetween(c, p));
    const m = sectors.get(dir) ?? new Map<string, number>();
    m.set(word, (m.get(word) ?? 0) + 1);
    sectors.set(dir, m);
  }
  const lines: string[] = [];
  const miles = ((grid.north - grid.south) * MI_PER_DEG_LAT).toFixed(1);
  lines.push(`WIDER COUNTRY (a coarse read about ${miles} miles across, centered on the hunter's screen; picks stay on screen)`);
  const ways: string[] = [];
  for (const dir of ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest']) {
    const m = sectors.get(dir);
    if (!m) continue;
    const top = [...m.entries()].sort((a, b) => b[1] - a[1])[0]!;
    ways.push(`${dir}: mostly ${top[0]}`);
  }
  if (ways.length) lines.push(`Around the screen: ${ways.join('; ')}.`);
  const beds = move.beds
    .filter((b) => !insideBounds(view, b.lngLat))
    .map((b) => ({ yd: Math.round(yardsBetween(c, b.lngLat) / 50) * 50, dir: compassWord(bearingBetween(c, b.lngLat)), score: b.score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  if (beds.length) lines.push(`Likely bedding beyond the screen: ${beds.map((b) => `${b.yd} yd ${b.dir}`).join('; ')} (from the screen's center).`);
  const sides = new Map<string, number>();
  for (const t of move.trails) {
    const s = entrySide(t, view);
    if (s) sides.set(s, (sides.get(s) ?? 0) + 1);
  }
  if (sides.size) {
    const list = [...sides.entries()].sort((a, b) => b[1] - a[1]).map(([s, n]) => `${n} from the ${s}`);
    lines.push(`Predicted travel corridors entering the screen: ${list.join(', ')}. Deer coming from off screen walk these.`);
  } else lines.push('No predicted travel corridors cross into the screen at this hour.');
  return lines;
}

interface WideState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  grid: GroundGrid | null;
  conditions: ConditionsModel | null;
  movement: MovementModel | null;
  /** The screen the wide read was made for. */
  view: Bounds | null;
  load(view: Bounds): Promise<void>;
  clear(): void;
}

let inflight: AbortController | null = null;

export const useWide = create<WideState>((set, get) => ({
  status: 'idle',
  grid: null,
  conditions: null,
  movement: null,
  view: null,
  async load(view) {
    const box = wideBox(view);
    const have = get().grid;
    // Same country: keep it, just remember the new screen.
    if (have && insideBounds(have, center(view)) && Math.abs((have.north - have.south) - (box.north - box.south)) < (box.north - box.south) * 0.3) {
      set({ view });
      return;
    }
    inflight?.abort();
    const ac = new AbortController();
    inflight = ac;
    set({ status: 'loading', view });
    try {
      const grid = await fetchGround(box, { signal: ac.signal, cells: WIDE_CELLS });
      if (ac.signal.aborted) return;
      set({ status: 'ready', grid, conditions: conditionsForGrid(grid), movement: createMovementModel(grid) });
    } catch {
      if (ac.signal.aborted) return;
      // The wide read is extra: without it Esau still reads the screen.
      set({ status: 'error' });
    }
  },
  clear() {
    inflight?.abort();
    set({ status: 'idle', grid: null, conditions: null, movement: null, view: null });
  },
}));

/** The wide read's trails and beds for one hour, or null if it isn't loaded. */
export function wideMovementAt(date: Date): { trails: Trail[]; beds: Bed[] } | null {
  const w = useWide.getState();
  if (w.status !== 'ready' || !w.conditions || !w.movement) return null;
  const hc = w.conditions.at(date);
  const m = w.movement.at(hc.sun, hc.weather, hc.wind, hc.atmosphere.movementFactor, date);
  return { trails: m.trails, beds: m.beds };
}
