import { angleDiff, bearingBetween, cellAt, cellCenter, yardsBetween, type LngLat } from './geo';
import type { Bed, Trail } from './movement';
import type { ElevationGrid } from './types';

/**
 * A suggested walk in from the hunter to a stand that keeps their scent off the deer: a least-cost path
 * over the grid where every step whose scent would drift onto a predicted bed or trail costs extra, and
 * steep ground and stepping on a trail cost a little. Pure. A suggestion read from this hour's wind and
 * thermals, not a promise: the air moves.
 */

export interface WalkRouteInput {
  grid: ElevationGrid;
  /** Where scent drifts from each cell this hour (wind and thermals together), and how wide it spreads. */
  scent: { driftBearing: ArrayLike<number>; spreadDeg: ArrayLike<number> };
  slopeDeg?: ArrayLike<number>;
  trails: Trail[];
  beds: Bed[];
  from: LngLat;
  to: LngLat;
}

export interface WalkRoute {
  path: LngLat[];
  yards: number;
  /** Yards of the walk where scent still reaches deer (when no clean way exists). */
  exposedYd: number;
}

/** Scent reaching a bed this far off busts it. */
export const BED_SMELL_YD = 250;
/** Scent drifting over a trail this close leaves it hot. */
export const TRAIL_SMELL_YD = 100;
/** Walking this close to a bed bumps the deer whatever the wind. */
const BED_NEAR_YD = 80;
/** Narrowest scent cone (half-angle) counted, for still air that barely spreads. */
const MIN_HALF_CONE = 25;
/** Extra cost, in yards walked, of one step that blows scent onto a bed / onto a trail / of crossing a trail / of passing near a bed. */
const BED_COST = 300;
const TRAIL_COST = 40;
const CROSS_COST = 20;
const NEAR_BED_COST = 300;
/** Near the stand, scent on the trail is the stand's own business (the sit spots already chose its wind). */
const STAND_GRACE_YD = 40;

export function walkRoute(i: WalkRouteInput): WalkRoute | null {
  const { grid, scent } = i;
  const { cols, rows } = grid;
  const start = cellAt(grid, i.from), goal = cellAt(grid, i.to);
  if (start == null || goal == null) return null;
  if (start === goal) return { path: [i.from, i.to], yards: Math.round(yardsBetween(i.from, i.to)), exposedYd: 0 };

  // One point per trail cell, so a long trail is cheap to check against.
  const trailCells = new Set<number>();
  for (const t of i.trails) for (const p of t.coordinates) {
    const c = cellAt(grid, p);
    if (c != null) trailCells.add(c);
  }
  const trailPts = [...trailCells].map((c) => cellCenter(grid, c));
  const n = cols * rows;
  const danger = new Float32Array(n).fill(-1);
  const dangerAt = (c: number): number => {
    if (danger[c]! >= 0) return danger[c]!;
    const p = cellCenter(grid, c);
    const drift = scent.driftBearing[c] ?? 0;
    const half = Math.max(MIN_HALF_CONE, (scent.spreadDeg[c] ?? 0) / 2);
    const downwind = (q: LngLat, reach: number) => {
      const d = yardsBetween(p, q);
      return d > 3 && d <= reach && angleDiff(bearingBetween(p, q), drift) <= half;
    };
    let cost = 0;
    if (i.beds.some((b) => downwind(b.lngLat, BED_SMELL_YD))) cost += BED_COST;
    if (i.beds.some((b) => yardsBetween(p, b.lngLat) < BED_NEAR_YD)) cost += NEAR_BED_COST;
    if (yardsBetween(p, i.to) > STAND_GRACE_YD && trailPts.some((q) => downwind(q, TRAIL_SMELL_YD))) cost += TRAIL_COST;
    if (trailCells.has(c) && c !== goal) cost += CROSS_COST;
    return (danger[c] = cost);
  };

  const g = new Float64Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  const heap = new MinHeap();
  const goalP = cellCenter(grid, goal);
  g[start] = 0;
  heap.push(start, yardsBetween(cellCenter(grid, start), goalP));
  while (heap.size) {
    const c = heap.pop();
    if (c === goal) break;
    if (closed[c]) continue;
    closed[c] = 1;
    const r = Math.floor(c / cols), col = c % cols;
    const pc = cellCenter(grid, c);
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const rr = r + dr, cc = col + dc;
        if (rr < 0 || cc < 0 || rr >= rows || cc >= cols) continue;
        const k = rr * cols + cc;
        if (closed[k]) continue;
        const pk = cellCenter(grid, k);
        const step = yardsBetween(pc, pk);
        const slope = i.slopeDeg ? (i.slopeDeg[k] ?? 0) / 20 : 0;
        const cost = g[c]! + step * (1 + slope * slope) + dangerAt(k) * (step / 45);
        if (cost < g[k]!) {
          g[k] = cost;
          prev[k] = c;
          heap.push(k, cost + yardsBetween(pk, goalP));
        }
      }
  }
  if (prev[goal] < 0) return null;

  const cells: number[] = [];
  for (let c = goal; c !== -1; c = prev[c]!) cells.push(c);
  cells.reverse();
  let exposedYd = 0;
  for (let k = 1; k < cells.length; k++)
    if (dangerAt(cells[k]!) >= TRAIL_COST) exposedYd += yardsBetween(cellCenter(grid, cells[k - 1]!), cellCenter(grid, cells[k]!));
  const mids = cells.slice(1, -1).map((c) => cellCenter(grid, c));
  const path = straighten([i.from, ...mids, i.to]);
  let yards = 0;
  for (let k = 1; k < path.length; k++) yards += yardsBetween(path[k - 1]!, path[k]!);
  return { path, yards: Math.round(yards), exposedYd: Math.round(exposedYd) };
}

/** Drop points that sit on a straight run, so the line on the map is calm. */
function straighten(p: LngLat[]): LngLat[] {
  if (p.length < 3) return p;
  const out = [p[0]!];
  for (let k = 1; k < p.length - 1; k++) {
    const a = bearingBetween(out[out.length - 1]!, p[k]!), b = bearingBetween(p[k]!, p[k + 1]!);
    if (angleDiff(a, b) > 10) out.push(p[k]!);
  }
  out.push(p[p.length - 1]!);
  return out;
}

class MinHeap {
  private ids: number[] = [];
  private keys: number[] = [];
  get size() {
    return this.ids.length;
  }
  push(id: number, key: number) {
    const { ids, keys } = this;
    let i = ids.length;
    ids.push(id);
    keys.push(key);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (keys[p]! <= key) break;
      ids[i] = ids[p]!;
      keys[i] = keys[p]!;
      i = p;
    }
    ids[i] = id;
    keys[i] = key;
  }
  pop(): number {
    const { ids, keys } = this;
    const top = ids[0]!;
    const id = ids.pop()!, key = keys.pop()!;
    if (ids.length) {
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i, mk = key;
        if (l < ids.length && keys[l]! < mk) (m = l), (mk = keys[l]!);
        if (r < ids.length && keys[r]! < mk) (m = r), (mk = keys[r]!);
        if (m === i) break;
        ids[i] = ids[m]!;
        keys[i] = keys[m]!;
        i = m;
      }
      ids[i] = id;
      keys[i] = key;
    }
    return top;
  }
}
