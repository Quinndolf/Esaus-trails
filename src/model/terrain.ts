import { cellSize, clamp, DEG, idx, type CellSize } from './geo';
import type { ElevationGrid } from './types';

/**
 * Terrain derived once per grid. Everything the thermal and wind models need
 * from the ground, independent of the hour.
 */
export interface Terrain extends CellSize {
  grid: ElevationGrid;
  /** Slope steepness in degrees. */
  slopeDeg: Float32Array;
  /** Direction each cell faces (downhill), compass degrees. NaN on dead-flat ground. */
  aspectDeg: Float32Array;
  /** D8 flow accumulation, 0-1 (92nd percentile = 1). High values are draws and creek bottoms. */
  drainage: Float32Array;
  /**
   * Topographic position, -1..1. Positive is a ridge, knob or shoulder;
   * negative is a hollow, draw or bottom. Measured against ground within ~150 m.
   */
  position: Float32Array;
  /** Canopy cover 0-100 (0 when the grid has none). */
  canopyPct: Float32Array;
}

const D8: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

export function analyzeTerrain(grid: ElevationGrid, opts: { positionRadiusM?: number } = {}): Terrain {
  const { cols, rows } = grid;
  const n = cols * rows;
  if (grid.elevationM.length !== n) {
    throw new Error(`elevationM has ${grid.elevationM.length} cells, expected ${cols}x${rows}=${n}`);
  }
  const size = cellSize(grid);
  const z = grid.elevationM;
  const slopeDeg = new Float32Array(n);
  const aspectDeg = new Float32Array(n);

  // Slope and aspect, central differences (one-sided at the edges), same as the prototype.
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = idx(cols, r, c);
      const cw = Math.max(0, c - 1);
      const ce = Math.min(cols - 1, c + 1);
      const rn = Math.max(0, r - 1);
      const rs = Math.min(rows - 1, r + 1);
      const dzEast = (z[idx(cols, r, ce)] - z[idx(cols, r, cw)]) / ((ce - cw) * size.cellX || 1);
      const dzNorth = (z[idx(cols, rn, c)] - z[idx(cols, rs, c)]) / ((rs - rn) * size.cellY || 1);
      slopeDeg[i] = Math.atan(Math.hypot(dzEast, dzNorth)) / DEG;
      if (Math.hypot(dzEast, dzNorth) < 1e-4) {
        aspectDeg[i] = Number.NaN;
      } else {
        let a = Math.atan2(-dzEast, -dzNorth) / DEG;
        if (a < 0) a += 360;
        aspectDeg[i] = a;
      }
    }
  }

  // D8 flow accumulation: each cell drains to its lowest neighbor.
  const receiver = new Int32Array(n).fill(-1);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = idx(cols, r, c);
      let best = i;
      let low = z[i];
      for (const [dc, dr] of D8) {
        const cc = c + dc;
        const rr = r + dr;
        if (cc < 0 || rr < 0 || cc >= cols || rr >= rows) continue;
        const j = idx(cols, rr, cc);
        if (z[j] < low - 0.15) {
          low = z[j];
          best = j;
        }
      }
      receiver[i] = best === i ? -1 : best;
    }
  }
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => z[b] - z[a]);
  const acc = new Float64Array(n).fill(1);
  for (const i of order) {
    const j = receiver[i];
    if (j >= 0) acc[j] += acc[i];
  }
  const sorted = Array.from(acc).sort((a, b) => a - b);
  const p92 = sorted[Math.floor(sorted.length * 0.92)] || 1;
  const drainage = new Float32Array(n);
  for (let i = 0; i < n; i++) drainage[i] = Math.min(1, (acc[i] - 1) / Math.max(1, p92 - 1));

  // Topographic position index: elevation minus the mean of a ring around it,
  // scaled by local relief so it reads the same in Kentucky hollows and Montana breaks.
  const radius = Math.max(1, Math.round((opts.positionRadiusM ?? 150) / (size.cellM || 1)));
  const tpi = new Float32Array(n);
  let absSum = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let sum = 0;
      let count = 0;
      for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
          if (!dr && !dc) continue;
          if (dr * dr + dc * dc > radius * radius) continue;
          const rr = r + dr;
          const cc = c + dc;
          if (rr < 0 || cc < 0 || rr >= rows || cc >= cols) continue;
          sum += z[idx(cols, rr, cc)];
          count++;
        }
      }
      const i = idx(cols, r, c);
      tpi[i] = count ? z[i] - sum / count : 0;
      absSum += Math.abs(tpi[i]);
    }
  }
  // Normalize by mean absolute TPI, but never let a flat field read as dramatic relief.
  const scale = Math.max(absSum / n, 1.5) * 2.5;
  const position = new Float32Array(n);
  for (let i = 0; i < n; i++) position[i] = clamp(tpi[i] / scale, -1, 1);

  const canopyPct = new Float32Array(n);
  if (grid.canopyPct) for (let i = 0; i < n; i++) canopyPct[i] = clamp(grid.canopyPct[i] ?? 0, 0, 100);

  return { grid, ...size, slopeDeg, aspectDeg, drainage, position, canopyPct };
}
