import { PNG } from "pngjs";
import type { GroundGrid, WeatherHour } from "../../src/esau/types";
import { getForecast, memoryCache } from "../../src/model/forecast";
import type { WeatherHour as ModelHour } from "../../src/model/types";
import { fetchCrops, fetchGreenness } from "./vegetation";

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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** GET JSON, waiting and retrying when the service says 429 (rate limited) or 5xx. */
async function getJsonRetry(f: Fetch, url: string, retryDelayMs: number, tries = 4): Promise<any> {
  for (let i = 1; ; i++) {
    const res = await f(url, { headers: { "user-agent": "esaus-trails (hunting map)" } });
    if (res.ok) return res.json();
    if ((res.status !== 429 && res.status < 500) || i >= tries) throw new Error(`${new URL(url).host} returned ${res.status}`);
    const asked = Number(res.headers.get("retry-after"));
    await sleep(Number.isFinite(asked) && res.headers.has("retry-after") ? Math.min(asked * 1000, 5000) : retryDelayMs * 2 ** (i - 1));
  }
}

/** Run tasks with at most `limit` in flight, so one tap is a trickle of calls rather than a burst. */
async function pool<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const out: T[] = new Array(tasks.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, tasks.length) }, async () => {
      while (next < tasks.length) {
        const i = next++;
        out[i] = await tasks[i]!();
      }
    }),
  );
  return out;
}

export interface ElevationOptions {
  /** First wait after a 429 when the service gives no Retry-After; doubles each try. */
  retryDelayMs?: number;
}

async function elevationFrom(source: "open-meteo" | "opentopodata", chunks: { lat: number; lng: number }[][], f: Fetch, delay: number): Promise<number[]> {
  const tasks = chunks.map((chunk) => async () => {
    if (source === "open-meteo") {
      const lat = chunk.map((p) => p.lat.toFixed(5)).join(",");
      const lng = chunk.map((p) => p.lng.toFixed(5)).join(",");
      const body = await getJsonRetry(f, `https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lng}`, delay);
      if (!Array.isArray(body?.elevation) || body.elevation.length !== chunk.length) throw new Error("elevation reply was malformed");
      return body.elevation as number[];
    }
    const locs = chunk.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join("|");
    const body = await getJsonRetry(f, `https://api.opentopodata.org/v1/srtm30m?locations=${locs}`, delay);
    const el = body?.results?.map((r: any) => r?.elevation);
    if (!Array.isArray(el) || el.length !== chunk.length || el.some((v: unknown) => typeof v !== "number")) throw new Error("elevation reply was malformed");
    return el as number[];
  });
  // Open-Meteo is per IP and shared by every hunter on this server: go gently.
  return (await pool(tasks, source === "open-meteo" ? 3 : 1)).flat();
}

/** Elevation per cell: Open-Meteo (Copernicus DEM), retried on 429, then Open Topo Data (SRTM) as a second source. */
export async function fetchElevation(b: Bbox, f: Fetch = fetch, cols = GRID_SIZE, rows = cols, opts: ElevationOptions = {}): Promise<number[]> {
  const pts = cellCenters(b, cols, rows);
  const chunks: (typeof pts)[] = [];
  for (let i = 0; i < pts.length; i += 100) chunks.push(pts.slice(i, i + 100));
  const delay = opts.retryDelayMs ?? 1000;
  try {
    return await elevationFrom("open-meteo", chunks, f, delay);
  } catch (first) {
    try {
      return await elevationFrom("opentopodata", chunks, f, delay);
    } catch {
      throw first;
    }
  }
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
const terrainCache = new Map<string, Terrain>();

export function clearGroundCache() {
  terrainCache.clear();
  terrainInFlight.clear();
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
  /** Wait after a 429 with no Retry-After header (ms). Tests set 0. */
  retryDelayMs?: number;
}

type Terrain = { elevationM: number[]; cover: number[]; crop: number[]; greenness?: number[]; notes: string[] };
// Simultaneous taps (and slider scrubs) on the same ground share one set of upstream calls.
const terrainInFlight = new Map<string, Promise<{ terrain: Terrain; cacheable: boolean }>>();

async function buildTerrain(b: Bbox, cols: number, rows: number, f: Fetch, retryDelayMs?: number): Promise<{ terrain: Terrain; cacheable: boolean }> {
  const notes: string[] = [];
  let demNote = "Elevation: Copernicus 90 m DEM via Open-Meteo, so small benches and creek banks can be smoothed out.";
  let cacheable = true;
  const [elevationM, cover, crop, greenness] = await Promise.all([
    fetchElevation(b, f, cols, rows, { retryDelayMs }).catch((err) => {
      // Esau can still read land cover and weather; say plainly that the slopes are a guess. Don't cache it.
      cacheable = false;
      demNote = `Elevation unavailable (${err instanceof Error ? err.message : "error"}); the ground is treated as flat, so ridges, benches and bedding on slopes can't be read here right now. Try again in a minute.`;
      return new Array(cols * rows).fill(0);
    }),
    fetchCover(b, f, cols, rows).catch((err) => {
      notes.push(`Land cover unavailable (${err instanceof Error ? err.message : "error"}); cover is unknown.`);
      return new Array(cols * rows).fill(0);
    }),
    fetchCrops(b, f, cols, rows).catch(() => {
      notes.push("Crop map (CDL) unavailable; cultivated fields show as cultivated crops.");
      return new Array(cols * rows).fill(0);
    }),
    fetchGreenness(b, f, cols, rows).catch(() => {
      notes.push("Overhead greenness (NAIP) unavailable; food is predicted from land cover and topography only.");
      return undefined;
    }),
  ]);
  return { terrain: { elevationM, cover, crop, greenness, notes: [demNote, ...notes] }, cacheable };
}

/** Grid over an exact box (the hour slider asks for the visible map). */
export async function buildGroundBbox(b: Bbox, cols: number, rows: number, opts: GroundOptions = {}): Promise<GroundGrid> {
  const f = opts.fetch ?? fetch;
  const now = opts.now ?? new Date();
  const key = [b.west, b.south, b.east, b.north].map((x) => x.toFixed(4)).join(",") + `/${cols}x${rows}`;

  let terrain = terrainCache.get(key);
  if (!terrain) {
    let building = terrainInFlight.get(key);
    if (!building) {
      building = buildTerrain(b, cols, rows, f, opts.retryDelayMs).finally(() => terrainInFlight.delete(key));
      terrainInFlight.set(key, building);
    }
    const built = await building;
    terrain = built.terrain;
    if (built.cacheable) {
      if (terrainCache.size > 500) terrainCache.clear();
      terrainCache.set(key, terrain);
    }
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
    crop: terrain.crop,
    ...(terrain.greenness ? { greenness: terrain.greenness } : {}),
    weather: { source: fc.source, hours },
    notes,
  };
}
