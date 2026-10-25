import { PNG } from "pngjs";
import type { GroundGrid, WeatherHour } from "../../src/esau/types";
import { getForecast, memoryCache } from "../../src/model/forecast";
import type { WeatherHour as ModelHour } from "../../src/model/types";

/**
 * Builds the GroundGrid Esau reads, from public sources with no API key:
 * - elevation: Open-Meteo elevation API (Copernicus 90 m DEM), 100 points per call
 * - land cover: MRLC NLCD 2021 WMS, decoded from its class colours
 * - weather: the wind and thermal module's getForecast (NWS, then Open-Meteo), next 24 hours
 * Crops (USDA CDL) are not wired yet; cultivated NLCD cells still count as food.
 */

export const GRID_SIZE = 32;
/** Half-height of the grid in degrees latitude: about 1.25 miles across, ~70 yd cells. */
export const HALF_LAT = 0.009;

type Fetch = typeof fetch;

export interface Bbox {
  west: number;
  south: number;
  east: number;
  north: number;
}

export function bboxAround(lat: number, lng: number): Bbox {
  const halfLng = HALF_LAT / Math.cos((lat * Math.PI) / 180);
  return { west: lng - halfLng, east: lng + halfLng, south: lat - HALF_LAT, north: lat + HALF_LAT };
}

/** Cell centres, row-major from the north-west corner. */
export function cellCenters(b: Bbox, cols = GRID_SIZE, rows = cols): { lat: number; lng: number }[] {
  const out: { lat: number; lng: number }[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      out.push({ lat: b.north - ((r + 0.5) / rows) * (b.north - b.south), lng: b.west + ((c + 0.5) / cols) * (b.east - b.west) });
  return out;
}

async function getJson(f: Fetch, url: string): Promise<any> {
  const res = await f(url, { headers: { "user-agent": "esaus-trails (hunting map)" } });
  if (!res.ok) throw new Error(`${new URL(url).host} returned ${res.status}`);
  return res.json();
}

export async function fetchElevation(b: Bbox, f: Fetch = fetch, cols = GRID_SIZE, rows = cols): Promise<number[]> {
  const pts = cellCenters(b, cols, rows);
  const chunks: (typeof pts)[] = [];
  for (let i = 0; i < pts.length; i += 100) chunks.push(pts.slice(i, i + 100));
  const parts = await Promise.all(
    chunks.map(async (chunk) => {
      const lat = chunk.map((p) => p.lat.toFixed(5)).join(",");
      const lng = chunk.map((p) => p.lng.toFixed(5)).join(",");
      const body = await getJson(f, `https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lng}`);
      if (!Array.isArray(body?.elevation) || body.elevation.length !== chunk.length) throw new Error("elevation reply was malformed");
      return body.elevation as number[];
    }),
  );
  return parts.flat();
}

/** NLCD legend colours as the MRLC WMS renders them. */
export const NLCD_COLORS: [number, [number, number, number]][] = [
  [11, [0x46, 0x6b, 0x9f]], [12, [0xd1, 0xde, 0xf8]], [21, [0xde, 0xc5, 0xc5]], [22, [0xd9, 0x92, 0x82]],
  [23, [0xeb, 0x00, 0x00]], [24, [0xab, 0x00, 0x00]], [31, [0xb3, 0xac, 0x9f]], [41, [0x68, 0xab, 0x5f]],
  [42, [0x1c, 0x5f, 0x2c]], [43, [0xb5, 0xc5, 0x8f]], [52, [0xcc, 0xb8, 0x79]], [71, [0xdf, 0xdf, 0xc2]],
  [81, [0xdc, 0xd9, 0x39]], [82, [0xab, 0x6c, 0x28]], [90, [0xb8, 0xd9, 0xeb]], [95, [0x6c, 0x9f, 0xb8]],
];

export function nlcdFromRgb(r: number, g: number, b: number): number {
  let best = 0, bestD = Infinity;
  for (const [code, [cr, cg, cb]] of NLCD_COLORS) {
    const d = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2;
    if (d < bestD) { bestD = d; best = code; }
  }
  // Far from every legend colour: probably a label, a no-data pixel or an edge blend.
  return bestD > 40 ** 2 ? 0 : best;
}

/** Majority class per grid cell from an image SCALE times the grid size. */
export function coverFromPng(png: Buffer, cols = GRID_SIZE, rows = cols, scale = 4): number[] {
  const img = PNG.sync.read(png);
  const out: number[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const votes = new Map<number, number>();
      for (let y = 0; y < scale; y++)
        for (let x = 0; x < scale; x++) {
          const px = Math.min(img.width - 1, Math.floor(((c * scale + x + 0.5) / (cols * scale)) * img.width));
          const py = Math.min(img.height - 1, Math.floor(((r * scale + y + 0.5) / (rows * scale)) * img.height));
          const i = (py * img.width + px) * 4;
          if (img.data[i + 3]! < 128) continue; // transparent: outside coverage
          const code = nlcdFromRgb(img.data[i]!, img.data[i + 1]!, img.data[i + 2]!);
          if (code) votes.set(code, (votes.get(code) ?? 0) + 1);
        }
      let best = 0, bestN = 0;
      for (const [code, k] of votes) if (k > bestN) { best = code; bestN = k; }
      out.push(best);
    }
  return out;
}

export async function fetchCover(b: Bbox, f: Fetch = fetch, cols = GRID_SIZE, rows = cols): Promise<number[]> {
  const url =
    "https://www.mrlc.gov/geoserver/mrlc_display/NLCD_2021_Land_Cover_L48/wms?service=WMS&version=1.1.1&request=GetMap" +
    `&layers=NLCD_2021_Land_Cover_L48&styles=&srs=EPSG:4326&bbox=${b.west},${b.south},${b.east},${b.north}` +
    `&width=${cols * 4}&height=${rows * 4}&format=image/png&transparent=true`;
  const res = await f(url, { headers: { "user-agent": "esaus-trails (hunting map)" } });
  if (!res.ok) throw new Error(`mrlc.gov returned ${res.status}`);
  if (!(res.headers.get("content-type") ?? "").includes("png")) throw new Error("mrlc.gov did not return an image");
  return coverFromPng(Buffer.from(await res.arrayBuffer()), cols, rows);
}

/** Weather for the grid: the wind and thermal module's provider chain (NWS, then Open-Meteo, then stale cache). */
export type ForecastFn = (lat: number, lng: number, now: Date) => Promise<{ hours: ModelHour[]; source: string; stale?: boolean }>;

const NWS_UA = process.env.NWS_USER_AGENT || "(esaus-trails, set NWS_USER_AGENT to 'app, contact@email')";
const forecastCache = memoryCache();

export const defaultForecast: ForecastFn = (lat, lng, now) =>
  getForecast(lat, lng, {
    now,
    cache: forecastCache,
    maxAgeMin: 30,
    // NWS asks for a User-Agent with contact info; a server can send one.
    fetch: (url, init) => fetch(url, { ...init, headers: { ...init?.headers, "user-agent": NWS_UA } }),
  });

export function toWeatherHours(hours: ModelHour[], now: Date): WeatherHour[] {
  const thisHour = Math.floor(now.getTime() / 36e5) * 36e5;
  return hours
    .filter((h) => Date.parse(h.at) >= thisHour)
    .slice(0, 24)
    .map((h) => ({ at: h.at, tempF: h.tempF, windMph: h.windMph, windFrom: h.windFrom, gustMph: h.gustMph, skyCover: h.skyCoverPct, pressureHpa: h.pressureHpa, dewPointF: h.dewPointF }));
}

// Terrain and cover don't change; weather does. Keep both, briefly, in memory.
const terrainCache = new Map<string, { elevationM: number[]; cover: number[]; notes: string[] }>();

export function clearGroundCache() {
  terrainCache.clear();
}

/** Grid centred near (lat, lng). Centres snap to ~250 yd so nearby taps share cached ground. */
export async function buildGround(lat: number, lng: number, opts: GroundOptions = {}): Promise<GroundGrid> {
  const snap = 0.0025;
  return buildGroundBbox(bboxAround(Math.round(lat / snap) * snap, Math.round(lng / snap) * snap), GRID_SIZE, GRID_SIZE, opts);
}

export interface GroundOptions {
  fetch?: Fetch;
  now?: Date;
  forecast?: ForecastFn;
}

/** Grid over an exact box (the hour slider asks for the visible map). */
export async function buildGroundBbox(b: Bbox, cols: number, rows: number, opts: GroundOptions = {}): Promise<GroundGrid> {
  const f = opts.fetch ?? fetch;
  const now = opts.now ?? new Date();
  const key = [b.west, b.south, b.east, b.north].map((x) => x.toFixed(4)).join(",") + `/${cols}x${rows}`;

  let terrain = terrainCache.get(key);
  if (!terrain) {
    const notes: string[] = ["Elevation: Copernicus 90 m DEM via Open-Meteo, so small benches and creek banks can be smoothed out."];
    const [elevationM, cover] = await Promise.all([
      fetchElevation(b, f, cols, rows),
      fetchCover(b, f, cols, rows).catch((err) => {
        notes.push(`Land cover unavailable (${err instanceof Error ? err.message : "error"}); cover is unknown.`);
        return new Array(cols * rows).fill(0);
      }),
    ]);
    notes.push("Crop types are not loaded yet; cultivated fields show as cultivated crops.");
    terrain = { elevationM, cover, notes };
    if (terrainCache.size > 500) terrainCache.clear();
    terrainCache.set(key, terrain);
  }

  const midLat = (b.north + b.south) / 2;
  const midLng = (b.east + b.west) / 2;
  const fc = await (opts.forecast ?? defaultForecast)(midLat, midLng, now);
  const hours = toWeatherHours(fc.hours, now);
  if (!hours.length) throw new Error("forecast had no future hours");
  const notes = fc.stale ? [...terrain.notes, "Weather is an older cached forecast; the phone may be out of service."] : terrain.notes;

  return {
    ...b,
    cols,
    rows,
    elevationM: terrain.elevationM,
    cover: terrain.cover,
    crop: new Array(cols * rows).fill(0),
    weather: { source: fc.source, hours },
    notes,
  };
}
