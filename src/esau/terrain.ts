import { GridGeom, FT_PER_M, M_PER_YD, angleBetween, bearingDeg, compass, compassWord, distanceM, toDeg } from "./geo";
import { treeHint } from "./trees";
import { coverClass, cropClass, foodScore } from "./landcover";
import type { GroundGrid, LatLng, Landform, NearbyFeature, Pin, SpotReading } from "./types";

/** Per-cell terrain derived once per grid and reused for every tap on it. */
export interface TerrainModel {
  geom: GridGeom;
  slopeDeg: Float32Array;
  /** Direction the slope faces, degrees; NaN where flat. */
  aspectDeg: Float32Array;
  /** Relative elevation vs. the ~300 yd neighborhood, meters. */
  tpiLarge: Float32Array;
  /** Relative elevation vs. the ~100 yd neighborhood, meters. */
  tpiSmall: Float32Array;
  /** D8 flow accumulation normalized 0-1 (draws and creeks run high). */
  flow: Float32Array;
  landform: Landform[];
  food: Float32Array;
  edge: Uint8Array;
}

const cache = new WeakMap<GroundGrid, TerrainModel>();

export function terrainModel(grid: GroundGrid): TerrainModel {
  const hit = cache.get(grid);
  if (hit) return hit;
  const m = buildModel(grid);
  cache.set(grid, m);
  return m;
}

function buildModel(grid: GroundGrid): TerrainModel {
  const geom = new GridGeom(grid);
  const { rows, cols } = grid;
  const n = rows * cols;
  const e = (r: number, c: number) =>
    grid.elevationM[geom.idx(Math.min(rows - 1, Math.max(0, r)), Math.min(cols - 1, Math.max(0, c)))] ?? 0;

  const slopeDeg = new Float32Array(n);
  const aspectDeg = new Float32Array(n);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // Horn's method on the 3x3 window.
      const dzdx =
        (e(r - 1, c + 1) + 2 * e(r, c + 1) + e(r + 1, c + 1) - (e(r - 1, c - 1) + 2 * e(r, c - 1) + e(r + 1, c - 1))) /
        (8 * geom.cellWm);
      // Rows grow southward, so north minus south.
      const dzdy =
        (e(r - 1, c - 1) + 2 * e(r - 1, c) + e(r - 1, c + 1) - (e(r + 1, c - 1) + 2 * e(r + 1, c) + e(r + 1, c + 1))) /
        (8 * geom.cellHm);
      const i = geom.idx(r, c);
      slopeDeg[i] = toDeg(Math.atan(Math.hypot(dzdx, dzdy)));
      // The slope faces downhill: opposite the gradient.
      aspectDeg[i] = slopeDeg[i]! < 2 ? NaN : (toDeg(Math.atan2(-dzdx, -dzdy)) + 360) % 360;
    }
  }

  const ringMean = (r: number, c: number, radiusM: number) => {
    const rr = Math.max(1, Math.round(radiusM / geom.cellHm));
    const rc = Math.max(1, Math.round(radiusM / geom.cellWm));
    let sum = 0, k = 0;
    for (let dr = -rr; dr <= rr; dr++)
      for (let dc = -rc; dc <= rc; dc++) {
        if (!dr && !dc) continue;
        if (!geom.inside(r + dr, c + dc)) continue;
        if ((dr / rr) ** 2 + (dc / rc) ** 2 > 1) continue;
        sum += e(r + dr, c + dc);
        k++;
      }
    return k ? sum / k : e(r, c);
  };
  const tpiLarge = new Float32Array(n);
  const tpiSmall = new Float32Array(n);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const i = geom.idx(r, c);
      tpiLarge[i] = e(r, c) - ringMean(r, c, 275);
      tpiSmall[i] = e(r, c) - ringMean(r, c, 95);
    }

  const flow = flowAccumulation(grid, geom);

  const food = new Float32Array(n);
  const edge = new Uint8Array(n);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const i = geom.idx(r, c);
      food[i] = foodScore(grid.cover[i] ?? 0, grid.crop[i] ?? 0);
      const woody = coverClass(grid.cover[i] ?? 0).woody;
      for (const [dr, dc] of N4) {
        if (!geom.inside(r + dr, c + dc)) continue;
        const other = coverClass(grid.cover[geom.idx(r + dr, c + dc)] ?? 0);
        if (woody !== other.woody && (other.open || coverClass(grid.cover[i] ?? 0).open)) edge[i] = 1;
      }
    }

  const model: TerrainModel = { geom, slopeDeg, aspectDeg, tpiLarge, tpiSmall, flow, landform: [], food, edge };
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) model.landform.push(classify(model, r, c));
  return model;
}

const N4: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const N8: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

function flowAccumulation(grid: GroundGrid, geom: GridGeom): Float32Array {
  const n = grid.rows * grid.cols;
  const acc = new Float32Array(n).fill(1);
  const order = [...Array(n).keys()].sort((a, b) => (grid.elevationM[b] ?? 0) - (grid.elevationM[a] ?? 0));
  for (const i of order) {
    const r = Math.floor(i / grid.cols), c = i % grid.cols;
    let best = -1, drop = 0;
    for (const [dr, dc] of N8) {
      if (!geom.inside(r + dr, c + dc)) continue;
      const j = geom.idx(r + dr, c + dc);
      const d = ((grid.elevationM[i] ?? 0) - (grid.elevationM[j] ?? 0)) / (dr && dc ? Math.SQRT2 : 1);
      if (d > drop) { drop = d; best = j; }
    }
    if (best >= 0) acc[best]! += acc[i]!;
  }
  // Normalize against the 95th percentile so one big creek does not flatten everything else.
  const sorted = [...acc].sort((a, b) => a - b);
  const p95 = Math.max(4, sorted[Math.floor(sorted.length * 0.95)] ?? 4);
  for (let i = 0; i < n; i++) acc[i] = Math.min(1, Math.log(acc[i]!) / Math.log(p95));
  return acc;
}

/**
 * Landform from slope position, slope and shape.
 * Slope position is where the cell sits between the lowest and highest ground within ~400 yd
 * (0 = bottom, 1 = top), which holds up across flat and steep country better than fixed relief.
 */
function classify(m: TerrainModel, r: number, c: number): Landform {
  const { geom } = m;
  const g = geom.g;
  const i = geom.idx(r, c);
  const slope = m.slopeDeg[i]!;
  const el = (rr: number, cc: number) => g.elevationM[geom.idx(rr, cc)] ?? 0;
  const here = el(r, c);

  const rr = Math.max(2, Math.round(365 / geom.cellHm));
  const rc = Math.max(2, Math.round(365 / geom.cellWm));
  let lo = here, hi = here, slopeSum = 0, k = 0;
  for (let dr = -rr; dr <= rr; dr++)
    for (let dc = -rc; dc <= rc; dc++) {
      if (!geom.inside(r + dr, c + dc)) continue;
      const v = el(r + dr, c + dc);
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  const range = hi - lo;
  const pos = range < 3 ? 0.5 : (here - lo) / range;

  // Saddle: a low spot along one axis of the ridge and a high spot across it, checked out to 3 cells.
  if (pos > 0.45) {
    const AXES: [number, number][] = [[1, 0], [0, 1], [1, 1], [1, -1]];
    for (const [ar, ac] of AXES) {
      const [pr, pc] = [ac, -ar]; // perpendicular axis
      for (const s of [1, 2, 3]) {
        if (!geom.inside(r + ar * s, c + ac * s) || !geom.inside(r - ar * s, c - ac * s)) continue;
        if (!geom.inside(r + pr * s, c + pc * s) || !geom.inside(r - pr * s, c - pc * s)) continue;
        const up = el(r + ar * s, c + ac * s) > here + 1 && el(r - ar * s, c - ac * s) > here + 1;
        const down = el(r + pr * s, c + pc * s) < here - 1 && el(r - pr * s, c - pc * s) < here - 1;
        if (up && down) return "saddle";
      }
    }
  }

  if (pos > 0.8) {
    // A point is ridge ground that falls away on nearly every side.
    let lower = 0;
    for (const [dr, dc] of N8) if (geom.inside(r + dr * 2, c + dc * 2) && el(r + dr * 2, c + dc * 2) < here - 1) lower++;
    if (lower >= 7) return "point";
    if (slope < 8) return "ridgetop";
  }
  if (pos < 0.15 && slope < 6) return "creek bottom";
  if (m.tpiSmall[i]! < -1.5 && m.flow[i]! > 0.6 && pos < 0.7) return "draw";

  // Bench: a shelf noticeably flatter than the sidehill around it.
  for (const s of [2]) {
    let sum = 0, n = 0;
    for (const [dr, dc] of N8) {
      if (!geom.inside(r + dr * s, c + dc * s)) continue;
      sum += m.slopeDeg[geom.idx(r + dr * s, c + dc * s)]!;
      n++;
    }
    slopeSum = n ? sum / n : 0;
    k = n;
  }
  if (k && slopeSum > 10 && slope < slopeSum * 0.5 && pos > 0.2 && pos < 0.9) return "bench";

  if (slope < 3) return pos > 0.8 ? "ridgetop" : pos < 0.25 ? "creek bottom" : "flat";
  if (pos > 0.7) return "upper slope";
  if (pos < 0.3) return "lower slope";
  return "mid slope";
}

const LANDFORM_FEATURES: Partial<Record<Landform, NearbyFeature["kind"]>> = {
  saddle: "saddle",
  bench: "bench",
  point: "point",
  draw: "draw",
};

/** Read one spot on the grid, in the words and units a hunter uses. */
export function readSpot(grid: GroundGrid, spot: LatLng, opts: { hunter?: LatLng; pins?: Pin[] } = {}): SpotReading {
  const m = terrainModel(grid);
  const { geom } = m;
  const { r, c } = geom.cellOf(spot);
  const i = geom.idx(r, c);
  const elevM = geom.elevationAt(spot);
  const coverCode = grid.cover[i] ?? 0;
  const cover = coverClass(coverCode);
  const crop = cropClass(grid.crop[i] ?? 0);
  const aspect = m.aspectDeg[i]!;

  const pins = opts.pins ?? [];
  const yd = (p: LatLng) => Math.round(distanceM(spot, p) / M_PER_YD);

  // Nearest food: grid food cells or a food pin, whichever is closer.
  let nearestFoodYd: number | null = null;
  let nearestFoodWhat: string | null = null;
  let nearestWaterYd: number | null = null;
  let nearestEdgeYd: number | null = null;
  const nearestByKind = new Map<NearbyFeature["kind"], NearbyFeature>();
  const consider = (f: NearbyFeature) => {
    const prev = nearestByKind.get(f.kind);
    if (!prev || f.yards < prev.yards) nearestByKind.set(f.kind, f);
  };

  for (let rr = 0; rr < grid.rows; rr++)
    for (let cc = 0; cc < grid.cols; cc++) {
      const j = geom.idx(rr, cc);
      if (j === i) continue;
      const p = geom.center(rr, cc);
      const d = yd(p);
      const brg = bearingDeg(spot, p);
      if (m.food[j]! >= 0.55 && (nearestFoodYd === null || d < nearestFoodYd)) {
        nearestFoodYd = d;
        nearestFoodWhat = cropClass(grid.crop[j] ?? 0)?.name ?? coverClass(grid.cover[j] ?? 0).name;
      }
      if (coverClass(grid.cover[j] ?? 0).water && (nearestWaterYd === null || d < nearestWaterYd)) nearestWaterYd = d;
      if (m.edge[j] && (nearestEdgeYd === null || d < nearestEdgeYd)) nearestEdgeYd = d;
      if (d > 450) continue;
      const kind = LANDFORM_FEATURES[m.landform[j]!];
      if (kind) consider({ kind, label: m.landform[j]!, yards: d, bearingDeg: Math.round(brg), compass: compass(brg), lat: p.lat, lng: p.lng });
    }
  if (m.edge[i]) nearestEdgeYd = 0;
  if (m.food[i]! >= 0.55) {
    nearestFoodYd = 0;
    nearestFoodWhat = crop?.name ?? cover.name;
  }

  for (const pin of pins) {
    const d = yd(pin);
    const brg = bearingDeg(spot, pin);
    if (pin.kind === "food" && (nearestFoodYd === null || d < nearestFoodYd)) {
      nearestFoodYd = d;
      nearestFoodWhat = pin.name ?? "food the hunter marked";
    }
    if (pin.kind === "water" && (nearestWaterYd === null || d < nearestWaterYd)) nearestWaterYd = d;
  }
  // Pins are individually interesting, so keep every one in range, not just the nearest.
  const pinFeatures: NearbyFeature[] = pins
    .map((pin) => ({ pin, d: yd(pin), brg: bearingDeg(spot, pin) }))
    .filter(({ d }) => d <= 600)
    .map(({ pin, d, brg }) => ({
      kind: "pin" as const,
      label: `${pin.kind} pin${pin.name ? ` "${pin.name}"` : ""}${pin.tags?.length ? ` [${pin.tags.join(", ")}]` : ""}${pin.note ? `: ${pin.note}` : ""}`,
      yards: d,
      bearingDeg: Math.round(brg),
      compass: compass(brg),
      lat: pin.lat,
      lng: pin.lng,
    }));

  let fromHunter: SpotReading["fromHunter"] = null;
  if (opts.hunter) {
    const brg = bearingDeg(opts.hunter, spot);
    const hunterElev = geom.contains(opts.hunter) ? geom.elevationAt(opts.hunter) : null;
    fromHunter = {
      yards: Math.round(distanceM(opts.hunter, spot) / M_PER_YD),
      bearingDeg: Math.round(brg),
      compass: compass(brg),
      climbFt: hunterElev === null ? 0 : Math.round((elevM - hunterElev) * FT_PER_M),
    };
  }

  return {
    elevationFt: Math.round(elevM * FT_PER_M),
    slopeDeg: Math.round(m.slopeDeg[i]!),
    aspectDeg: Number.isNaN(aspect) ? null : Math.round(aspect),
    aspectName: Number.isNaN(aspect) ? null : `${compassWord(aspect)}-facing`,
    reliefFt: Math.round(m.tpiLarge[i]! * FT_PER_M),
    landform: m.landform[i]!,
    cover: { code: coverCode, name: cover.name, woody: cover.woody },
    crop: crop ? { code: grid.crop[i] ?? 0, name: crop.name } : null,
    canopy: cover.canopy,
    trees: treeHint(coverCode, grid.forestType?.length === grid.cover.length ? grid.forestType[i] : undefined),
    nearestFoodYd,
    nearestFoodWhat,
    nearestWaterYd,
    nearestEdgeYd,
    fromHunter,
    nearby: [...nearestByKind.values(), ...pinFeatures].sort((a, b) => a.yards - b.yards),
  };
}

/** True when the hunter's scent (carried toward `scentToward`) would reach `target` from `from`. */
export function scentReaches(from: LatLng, target: LatLng, scentTowardDeg: number, coneDeg = 42): boolean {
  return angleBetween(bearingDeg(from, target), scentTowardDeg) <= coneDeg;
}
