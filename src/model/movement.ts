import { coverClass, foodScore } from '../esau/landcover';
import type { GroundGrid, Pin } from '../esau/types';
import { cellAt, cellCenter, clamp, idx, M_TO_FT, M_TO_YD, smoothstep, yardsBetween, type LngLat } from './geo';
import { analyzeTerrain, type Terrain } from './terrain';
import type { WindField } from './wind';
import type { SunPosition, WeatherHour } from './types';

/**
 * Whitetail bedding, travel corridors and trails, ported from the prototype's
 * model (`ve`, `Se`, `ye` in its bundle) with its weights kept as they were.
 * Then layered on top: what deer are doing this hour (bedded, moving, feeding),
 * so the hour slider can shift probable presence across the ground.
 */

export interface Bed {
  lngLat: LngLat;
  score: number;
  elevationFt: number;
}

export interface Trail {
  coordinates: LngLat[];
  /** 0.35-1, strongest first. */
  weight: number;
}

/** Share of deer doing each thing this hour; sums to 1. */
export interface Activity {
  bedded: number;
  moving: number;
  feeding: number;
  /** Which way trail traffic runs, when it runs. */
  heading: 'to-bed' | 'to-food' | 'none';
}

export interface MovementHour {
  bedding: Float32Array;
  corridor: Float32Array;
  /** 0-1, where a deer most likely is this hour. */
  presence: Float32Array;
  beds: Bed[];
  trails: Trail[];
  activity: Activity;
  line: string;
}

const FOREST = new Set([41, 42, 43]);
const D8: [number, number, number][] = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, 1.414],
  [1, -1, 1.414],
  [-1, 1, 1.414],
  [-1, -1, 1.414],
];

interface Static {
  terrain: Terrain;
  canopy: Float32Array;
  saddle: Uint8Array;
  edge: Uint8Array;
  foodCells: number[];
  foodYd: Float32Array;
  /** 0-1 food draw near each cell, for the feeding share of presence. */
  foodNear: Float32Array;
  cost: Float32Array;
}

function buildStatic(grid: GroundGrid, pins: Pin[]): Static {
  const terrain = analyzeTerrain(grid);
  const { cols, rows } = grid;
  const n = cols * rows;
  const z = grid.elevationM;
  const canopy = new Float32Array(n);
  for (let i = 0; i < n; i++) canopy[i] = coverClass(grid.cover[i] ?? 0).canopy * 100;

  // Saddles (low one way, high the other) and forest/open edges.
  const saddle = new Uint8Array(n);
  const edge = new Uint8Array(n);
  for (let r = 1; r < rows - 1; r++) {
    for (let c = 1; c < cols - 1; c++) {
      const i = idx(cols, r, c);
      const a = z[i],
        w = z[i - 1],
        e = z[i + 1],
        no = z[i - cols],
        s = z[i + cols];
      if ((a < no && a < s && a > w && a > e) || (a > no && a > s && a < w && a < e)) saddle[i] = 1;
      const here = coverClass(grid.cover[i] ?? 0);
      const forest = FOREST.has(grid.cover[i]);
      if (!forest && !here.open) continue;
      for (const [dc, dr] of D8.slice(0, 4)) {
        const j = idx(cols, r + dr, c + dc);
        const nf = FOREST.has(grid.cover[j]);
        const no2 = coverClass(grid.cover[j] ?? 0).open;
        if ((forest && no2) || (here.open && nf)) {
          edge[i] = 1;
          break;
        }
      }
    }
  }

  const foodCells: number[] = [];
  for (let i = 0; i < n; i++) if (foodScore(grid.cover[i] ?? 0, grid.crop[i] ?? 0) >= 0.55) foodCells.push(i);
  for (const p of pins) {
    if (p.kind !== 'food') continue;
    const i = cellAt(grid, [p.lng, p.lat]);
    if (i != null) foodCells.push(i);
  }
  const uniqueFood = Array.from(new Set(foodCells));
  const foodYd = new Float32Array(n).fill(9999);
  if (uniqueFood.length) {
    const pts = uniqueFood.map((i) => cellCenter(grid, i));
    for (let i = 0; i < n; i++) {
      const p = cellCenter(grid, i);
      let best = 9999;
      for (const q of pts) best = Math.min(best, yardsBetween(p, q));
      foodYd[i] = best;
    }
  }
  const foodNear = new Float32Array(n);
  for (let i = 0; i < n; i++) foodNear[i] = smoothstep(220, 0, foodYd[i]);

  // Travel cost: steep, wet, built-up and wide-open ground is expensive; edges, saddles and draws are cheap.
  const cost = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const d = terrain.slopeDeg[i];
    const cc = coverClass(grid.cover[i] ?? 0);
    let k = 1.15;
    if (d >= 18 && d < 28) k += (d - 18) * 0.11;
    else if (d >= 28) k += 2.2 + (d - 28) * 0.22;
    else if (d < 8) k += 0.12;
    if (cc.water) k += 8;
    if (grid.cover[i] === 24) k += 5;
    else if (grid.cover[i] === 23) k += 2.2;
    if (cc.open && !edge[i]) k += 1.5;
    if (edge[i]) k *= 0.46;
    if (saddle[i]) k *= 0.42;
    if (terrain.drainage[i] > 0.4 && !cc.water) k *= 0.58;
    if (FOREST.has(grid.cover[i]) && !edge[i]) k *= 0.86;
    cost[i] = Math.max(0.18, k);
  }
  return { terrain, canopy, saddle, edge, foodCells: uniqueFood, foodYd, foodNear, cost };
}

function beddingScores(
  grid: GroundGrid,
  s: Static,
  warm: boolean,
  wind: WindField | null,
  windy: boolean,
): Float32Array {
  const n = grid.cols * grid.rows;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = s.terrain;
    const d = t.slopeDeg[i];
    const aspect = t.aspectDeg[i];
    const g = Number.isFinite(aspect) ? Math.cos((aspect * Math.PI) / 180) : 0;
    const cover = grid.cover[i] ?? 0;
    const cc = coverClass(cover);
    let b = 0.08;
    // Warm days: cool north faces. Cold days: sunny south faces.
    b += warm ? g * 0.28 + 0.08 : -g * 0.18 + 0.16;
    if (FOREST.has(cover)) b += 0.26;
    else if (cover === 52 || cover === 90) b += 0.16;
    else if (cc.open || cc.developed) b -= 0.18;
    if (cc.water) b -= 0.4;
    b += (s.canopy[i] / 100) * 0.12;
    if (d >= 6 && d <= 24) b += 0.16 * (1 - Math.abs(d - 14) / 16);
    else if (d > 32) b -= 0.28;
    if (d >= 8 && d <= 26) b += 0.08;
    const fy = s.foodYd[i];
    const y = fy < 50 ? 0.2 : fy < 140 ? 0.55 : fy < 380 ? 1 : fy < 700 ? 0.45 : 0.12;
    b += 0.22 * y;
    if (foodScore(cover, grid.crop[i] ?? 0) > 0.7) b -= 0.12;
    if (s.edge[i] && FOREST.has(cover)) b += 0.06;
    // New: in a real wind deer tuck into the lee.
    if (windy && wind?.sheltered[i]) b += 0.08;
    out[i] = clamp(b, 0, 1);
  }
  return out;
}

function pickBeds(grid: GroundGrid, score: Float32Array, min = 0.58, spacingYd = 220, max = 6): Bed[] {
  const { cols, rows } = grid;
  const peaks: Bed[] = [];
  for (let r = 1; r < rows - 1; r++) {
    for (let c = 1; c < cols - 1; c++) {
      const i = idx(cols, r, c);
      if (score[i] < min) continue;
      let top = true;
      for (let dr = -1; dr <= 1 && top; dr++)
        for (let dc = -1; dc <= 1; dc++) if ((dr || dc) && score[idx(cols, r + dr, c + dc)] > score[i]) top = false;
      if (top) peaks.push({ lngLat: cellCenter(grid, i), score: score[i], elevationFt: grid.elevationM[i] * M_TO_FT });
    }
  }
  peaks.sort((a, b) => b.score - a.score);
  const out: Bed[] = [];
  for (const p of peaks) {
    if (out.some((q) => yardsBetween(p.lngLat, q.lngLat) < spacingYd)) continue;
    out.push(p);
    if (out.length === max) break;
  }
  return out;
}

/** Multi-source Dijkstra over the 8-neighbor grid. */
function dijkstra(cost: Float32Array, cols: number, rows: number, sources: number[]) {
  const n = cols * rows;
  const dist = new Float64Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const heap: [number, number][] = [];
  const push = (d: number, i: number) => {
    heap.push([d, i]);
    let k = heap.length - 1;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (heap[p][0] <= heap[k][0]) break;
      [heap[p], heap[k]] = [heap[k], heap[p]];
      k = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1,
          r = l + 1;
        let m = k;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === k) break;
        [heap[m], heap[k]] = [heap[k], heap[m]];
        k = m;
      }
    }
    return top;
  };
  for (const s of sources) {
    dist[s] = 0;
    push(0, s);
  }
  while (heap.length) {
    const [d, i] = pop();
    if (d !== dist[i]) continue;
    const r = Math.floor(i / cols),
      c = i % cols;
    for (const [dc, dr, w] of D8) {
      const cc = c + dc,
        rr = r + dr;
      if (cc < 0 || rr < 0 || cc >= cols || rr >= rows) continue;
      const j = idx(cols, rr, cc);
      const nd = d + w * 0.5 * (cost[i] + cost[j]);
      if (nd < dist[j]) {
        dist[j] = nd;
        prev[j] = i;
        push(nd, j);
      }
    }
  }
  return { dist, prev };
}

function trailsAndCorridor(grid: GroundGrid, s: Static, beds: Bed[], pins: Pin[]) {
  const n = grid.cols * grid.rows;
  const corridor = new Float32Array(n);
  const trails: Trail[] = [];
  const targets = new Set<number>();
  for (const b of beds) {
    const i = cellAt(grid, b.lngLat);
    if (i != null) targets.add(i);
  }
  for (const p of pins) {
    if (p.kind !== 'water' && p.kind !== 'bed') continue;
    const i = cellAt(grid, [p.lng, p.lat]);
    if (i != null) targets.add(i);
  }
  const sources = s.foodCells.slice(0, 80);
  if (sources.length && targets.size) {
    const { dist, prev } = dijkstra(s.cost, grid.cols, grid.rows, sources);
    [...targets]
      .filter((t) => Number.isFinite(dist[t]))
      .sort((a, b) => dist[a] - dist[b])
      .slice(0, 8)
      .forEach((t, k) => {
        const path: number[] = [];
        for (let i = t, guard = 0; i >= 0 && guard <= n; i = prev[i], guard++) path.push(i);
        path.reverse();
        if (path.length < 3) return;
        const weight = Math.max(0.35, 1 - k * 0.08);
        trails.push({ coordinates: path.map((i) => cellCenter(grid, i)), weight });
        for (const i of path) corridor[i] += weight;
      });
  }
  let top = 0.001;
  for (let i = 0; i < n; i++) {
    const d = s.terrain.slopeDeg[i];
    if (s.saddle[i] && d < 30) corridor[i] = Math.max(corridor[i], 0.34);
    if (s.edge[i] && d < 28) corridor[i] = Math.max(corridor[i], 0.28);
    if (s.terrain.drainage[i] > 0.62 && !coverClass(grid.cover[i] ?? 0).water && d < 24)
      corridor[i] = Math.max(corridor[i], 0.32);
    top = Math.max(top, corridor[i]);
  }
  for (let i = 0; i < n; i++) corridor[i] /= top;
  return { corridor, trails };
}

/**
 * Whitetail daily rhythm from sun height: moving around first and last light,
 * bedded through the middle of the day, out feeding after dark. Heat, a hard
 * wind and a bright midday all push them toward the bed.
 */
export function whitetailActivity(sun: SunPosition, weather: WeatherHour): Activity {
  const alt = sun.altitude;
  const twilight = smoothstep(-14, -4, alt) * smoothstep(16, 4, alt); // peak from just before light to ~16° up
  let moving = 0.12 + 0.68 * twilight;
  let feeding = alt < -4 ? 0.55 : 0.08 * smoothstep(10, 0, alt);
  if (weather.windMph >= 18) moving *= 0.6;
  if (weather.tempF >= 75 && alt > 10) moving *= 0.6;
  if (weather.tempF <= 20 && alt > 15) moving *= 1.25; // cold snaps bring midday feeding
  const bedded = Math.max(0.05, 1 - moving - feeding);
  const sum = bedded + moving + feeding;
  moving /= sum;
  feeding /= sum;
  const heading: Activity['heading'] = moving < 0.3 ? 'none' : sun.azimuth < 180 ? 'to-bed' : 'to-food';
  return { bedded: bedded / sum, moving, feeding, heading };
}

function movementLine(a: Activity, beds: number): string {
  if (a.moving >= 0.45) {
    return a.heading === 'to-bed'
      ? 'Prime time. Deer are coming off food and working back to bed.'
      : 'Prime time. Deer are getting up and heading for food.';
  }
  if (a.feeding >= 0.45) return 'Dark. Deer are out on the food, not in the timber.';
  if (a.bedded >= 0.6)
    return beds
      ? 'Midday. They are bedded. Sit tight or slip in on a bed you trust.'
      : 'Midday. They are bedded somewhere thick.';
  return 'Some movement. Trails and edges are worth watching.';
}

export interface MovementModel {
  terrain: Terrain;
  at(sun: SunPosition, weather: WeatherHour, wind?: WindField): MovementHour;
}

/** Build once per grid and pin set; `at` is cheap and memoized per temperature/wind band. */
export function createMovementModel(grid: GroundGrid, pins: Pin[] = []): MovementModel {
  const s = buildStatic(grid, pins);
  const bands = new Map<string, { bedding: Float32Array; beds: Bed[]; trails: Trail[]; corridor: Float32Array }>();
  return {
    terrain: s.terrain,
    at(sun, weather, wind) {
      const warm = weather.tempF >= 48;
      const windy = weather.windMph >= 12 && !!wind;
      const key = `${warm}|${windy}`;
      let band = bands.get(key);
      if (!band) {
        const bedding = beddingScores(grid, s, warm, wind ?? null, windy);
        const beds = pickBeds(grid, bedding);
        band = { bedding, beds, ...trailsAndCorridor(grid, s, beds, pins) };
        bands.set(key, band);
      }
      const activity = whitetailActivity(sun, weather);
      const n = band.bedding.length;
      const presence = new Float32Array(n);
      let top = 0.001;
      for (let i = 0; i < n; i++) {
        const v =
          activity.bedded * band.bedding[i] ** 2 +
          activity.moving * band.corridor[i] +
          activity.feeding * s.foodNear[i];
        presence[i] = v;
        top = Math.max(top, v);
      }
      for (let i = 0; i < n; i++) presence[i] /= top;
      return {
        bedding: band.bedding,
        corridor: band.corridor,
        presence,
        beds: band.beds,
        trails: band.trails,
        activity,
        line: movementLine(activity, band.beds.length),
      };
    },
  };
}

export const yardsPerCell = (t: Terrain) => t.cellM * M_TO_YD;
