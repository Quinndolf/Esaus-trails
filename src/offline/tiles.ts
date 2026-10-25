export interface Bounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface TileXYZ {
  x: number;
  y: number;
  z: number;
}

export function lngToTileX(lng: number, z: number): number {
  return Math.floor(((lng + 180) / 360) * 2 ** z);
}

export function latToTileY(lat: number, z: number): number {
  const clamped = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const r = (clamped * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
}

function tileRange(b: Bounds, z: number) {
  const max = 2 ** z - 1;
  const clamp = (v: number) => Math.max(0, Math.min(max, v));
  return {
    x0: clamp(lngToTileX(b.west, z)),
    x1: clamp(lngToTileX(b.east, z)),
    y0: clamp(latToTileY(b.north, z)),
    y1: clamp(latToTileY(b.south, z)),
  };
}

export function countTiles(b: Bounds, minZoom: number, maxZoom: number): number {
  let n = 0;
  for (let z = minZoom; z <= maxZoom; z++) {
    const r = tileRange(b, z);
    n += (r.x1 - r.x0 + 1) * (r.y1 - r.y0 + 1);
  }
  return n;
}

export function* tilesIn(b: Bounds, minZoom: number, maxZoom: number): Generator<TileXYZ> {
  for (let z = minZoom; z <= maxZoom; z++) {
    const r = tileRange(b, z);
    for (let x = r.x0; x <= r.x1; x++) for (let y = r.y0; y <= r.y1; y++) yield { x, y, z };
  }
}

/** Web Mercator coords of a pixel, with MapLibre's own arithmetic so the numbers print identically. */
function mercCoords(px: number, py: number, z: number): [number, number] {
  const resolution = (2 * Math.PI * 6378137) / 256 / Math.pow(2, z);
  return [px * resolution - (2 * Math.PI * 6378137) / 2.0, py * resolution - (2 * Math.PI * 6378137) / 2.0];
}

/** The tile's box exactly as MapLibre fills {bbox-epsg-3857}, so a saved URL matches the live request. */
export function tileBBox3857(t: TileXYZ): string {
  const y = Math.pow(2, t.z) - t.y - 1;
  const min = mercCoords(t.x * 256, y * 256, t.z);
  const max = mercCoords((t.x + 1) * 256, (y + 1) * 256, t.z);
  return min[0] + ',' + min[1] + ',' + max[0] + ',' + max[1];
}

export function tileUrl(template: string, t: TileXYZ): string {
  return template
    .replace(/{z}/g, String(t.z))
    .replace(/{x}/g, String(t.x))
    .replace(/{y}/g, String(t.y))
    .replace(/{bbox-epsg-3857}/g, () => tileBBox3857(t));
}
