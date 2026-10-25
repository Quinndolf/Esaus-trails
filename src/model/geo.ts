import { angleDelta, cardinal, normalizeBearing, type LngLat } from '../map/geo';
import type { ElevationGrid } from './types';

export { cardinal, normalizeBearing, type LngLat };

export const DEG = Math.PI / 180;
export const M_TO_YD = 1.09361;
export const M_TO_FT = 3.28084;

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** 0 at edge0, 1 at edge1, smooth between. Works with edge0 > edge1 too. */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Smallest angle between two bearings, 0-180. */
export const angleDiff = (a: number, b: number) => Math.abs(angleDelta(a, b));

/** Bearing of a vector given as east/north components. */
export const vectorBearing = (east: number, north: number) => normalizeBearing(Math.atan2(east, north) / DEG);

/** East/north components of a vector pointing along `bearing` with length `len`. */
export function bearingVector(bearing: number, len = 1): [number, number] {
  return [Math.sin(bearing * DEG) * len, Math.cos(bearing * DEG) * len];
}

const COMPASS8 = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
const COMPASS16 = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

/** "northwest", for sentences. Use `cardinal` for "NW". */
export const compassWord = (b: number) => COMPASS8[Math.round(normalizeBearing(b) / 45) % 8];

export function compassToDegrees(s: string): number | null {
  const i = COMPASS16.indexOf(s.trim().toUpperCase());
  return i < 0 ? null : i * 22.5;
}

export function bearingBetween([lng1, lat1]: LngLat, [lng2, lat2]: LngLat): number {
  const p1 = lat1 * DEG;
  const p2 = lat2 * DEG;
  const dl = (lng2 - lng1) * DEG;
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return normalizeBearing(Math.atan2(y, x) / DEG);
}

/** Equirectangular distance in yards. Plenty for a few miles of ground. */
export function yardsBetween([lng1, lat1]: LngLat, [lng2, lat2]: LngLat): number {
  const mid = ((lat1 + lat2) / 2) * DEG;
  const dx = (lng2 - lng1) * 111320 * Math.cos(mid);
  const dy = (lat2 - lat1) * 111320;
  return Math.hypot(dx, dy) * M_TO_YD;
}

/** Move a point `yards` along `bearing` (flat-earth step, for short hops across a grid). */
export function stepYards([lng, lat]: LngLat, bearing: number, yards: number): LngLat {
  const [e, n] = bearingVector(bearing, yards / M_TO_YD);
  return [lng + e / (111320 * Math.cos(lat * DEG)), lat + n / 111320];
}

export interface CellSize {
  /** Cell width, meters. */
  cellX: number;
  /** Cell height, meters. */
  cellY: number;
  cellM: number;
}

export function cellSize(g: ElevationGrid): CellSize {
  const midLat = ((g.south + g.north) / 2) * DEG;
  const cellX = ((g.east - g.west) / g.cols) * 111320 * Math.cos(midLat);
  const cellY = ((g.north - g.south) / g.rows) * 111320;
  return { cellX, cellY, cellM: (cellX + cellY) / 2 };
}

export const idx = (cols: number, row: number, col: number) => row * cols + col;

/** Cell index under a point, or null when it is off the grid. */
export function cellAt(g: ElevationGrid, [lng, lat]: LngLat): number | null {
  if (lng < g.west || lng > g.east || lat < g.south || lat > g.north) return null;
  const col = clamp(Math.floor(((lng - g.west) / (g.east - g.west)) * g.cols), 0, g.cols - 1);
  const row = clamp(Math.floor(((g.north - lat) / (g.north - g.south)) * g.rows), 0, g.rows - 1);
  return idx(g.cols, row, col);
}

export function cellCenter(g: ElevationGrid, i: number): LngLat {
  const row = Math.floor(i / g.cols);
  const col = i % g.cols;
  return [g.west + ((col + 0.5) * (g.east - g.west)) / g.cols, g.north - ((row + 0.5) * (g.north - g.south)) / g.rows];
}

export const gridCenter = (g: ElevationGrid): LngLat => [(g.west + g.east) / 2, (g.south + g.north) / 2];
