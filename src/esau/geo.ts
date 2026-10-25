import type { GroundGrid, LatLng } from "./types";

export const toRad = (d: number) => (d * Math.PI) / 180;
export const toDeg = (r: number) => (r * 180) / Math.PI;
export const M_PER_YD = 0.9144;
export const FT_PER_M = 3.28084;

const COMPASS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
const COMPASS_WORDS = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"];

export function norm360(d: number): number {
  return ((d % 360) + 360) % 360;
}

/** 16-point label, e.g. "NNW". */
export function compass(deg: number): string {
  return COMPASS[Math.round(norm360(deg) / 22.5) % 16]!;
}

/** 8-point word, e.g. "northwest". */
export function compassWord(deg: number): string {
  return COMPASS_WORDS[Math.round(norm360(deg) / 45) % 8]!;
}

/** Smallest angle between two bearings, 0-180. */
export function angleBetween(a: number, b: number): number {
  const d = Math.abs(norm360(a) - norm360(b));
  return d > 180 ? 360 - d : d;
}

/** Equirectangular distance in meters. Fine at the few-mile scale Esau reads. */
export function distanceM(a: LatLng, b: LatLng): number {
  const midLat = toRad((a.lat + b.lat) / 2);
  const dx = toRad(b.lng - a.lng) * Math.cos(midLat) * 6371000;
  const dy = toRad(b.lat - a.lat) * 6371000;
  return Math.hypot(dx, dy);
}

/** Initial bearing a -> b in degrees. */
export function bearingDeg(a: LatLng, b: LatLng): number {
  const midLat = toRad((a.lat + b.lat) / 2);
  const dx = (b.lng - a.lng) * Math.cos(midLat);
  const dy = b.lat - a.lat;
  return norm360(toDeg(Math.atan2(dx, dy)));
}

/** Low-precision solar position (good to well under a degree), same formula as the prototype. */
export function sunPosition(date: Date, lat: number, lng: number): { altitudeDeg: number; azimuthDeg: number } {
  const d = date.getTime() / 864e5 + 2440587.5 - 2451545;
  const L = norm360(280.46 + 0.9856474 * d);
  const g = toRad(norm360(357.528 + 0.9856003 * d));
  const lambda = toRad(norm360(L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)));
  const eps = toRad(23.439 - 4e-7 * d);
  const dec = Math.asin(Math.sin(eps) * Math.sin(lambda));
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda));
  const gmst = norm360(((18.697374558 + 24.06570982441908 * d) % 24) * 15);
  const ha = toRad(norm360(gmst + lng)) - ra;
  const phi = toRad(lat);
  const alt = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(ha));
  const az = Math.atan2(-Math.sin(ha), Math.tan(dec) * Math.cos(phi) - Math.sin(phi) * Math.cos(ha));
  return { altitudeDeg: toDeg(alt), azimuthDeg: norm360(toDeg(az)) };
}

/** Grid geometry helpers. Row 0 is the north edge. */
export class GridGeom {
  readonly cellWm: number;
  readonly cellHm: number;
  readonly g: GroundGrid;
  constructor(g: GroundGrid) {
    this.g = g;
    const midLat = toRad((g.north + g.south) / 2);
    this.cellWm = (toRad(g.east - g.west) * Math.cos(midLat) * 6371000) / g.cols;
    this.cellHm = (toRad(g.north - g.south) * 6371000) / g.rows;
  }
  idx(r: number, c: number): number {
    return r * this.g.cols + c;
  }
  inside(r: number, c: number): boolean {
    return r >= 0 && c >= 0 && r < this.g.rows && c < this.g.cols;
  }
  contains(p: LatLng): boolean {
    const g = this.g;
    return p.lng >= g.west && p.lng <= g.east && p.lat >= g.south && p.lat <= g.north;
  }
  /** Cell holding a point, clamped to the grid edge. */
  cellOf(p: LatLng): { r: number; c: number } {
    const g = this.g;
    const c = Math.floor(((p.lng - g.west) / (g.east - g.west)) * g.cols);
    const r = Math.floor(((g.north - p.lat) / (g.north - g.south)) * g.rows);
    return { r: Math.min(g.rows - 1, Math.max(0, r)), c: Math.min(g.cols - 1, Math.max(0, c)) };
  }
  center(r: number, c: number): LatLng {
    const g = this.g;
    return {
      lat: g.north - ((r + 0.5) / g.rows) * (g.north - g.south),
      lng: g.west + ((c + 0.5) / g.cols) * (g.east - g.west),
    };
  }
  /** Bilinear elevation (m) at a point. */
  elevationAt(p: LatLng): number {
    const g = this.g;
    const fx = Math.min(g.cols - 1, Math.max(0, ((p.lng - g.west) / (g.east - g.west)) * g.cols - 0.5));
    const fy = Math.min(g.rows - 1, Math.max(0, ((g.north - p.lat) / (g.north - g.south)) * g.rows - 0.5));
    const c0 = Math.floor(fx), r0 = Math.floor(fy);
    const c1 = Math.min(g.cols - 1, c0 + 1), r1 = Math.min(g.rows - 1, r0 + 1);
    const tx = fx - c0, ty = fy - r0;
    const e = (r: number, c: number) => g.elevationM[this.idx(r, c)] ?? 0;
    return (e(r0, c0) * (1 - tx) + e(r0, c1) * tx) * (1 - ty) + (e(r1, c0) * (1 - tx) + e(r1, c1) * tx) * ty;
  }
}
