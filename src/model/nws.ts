import { compassToDegrees } from './geo';
import type { Forecast, WeatherHour, WeatherObservation } from './types';

/**
 * National Weather Service (api.weather.gov). Free, no key, US only, sends CORS headers.
 *
 * We use the raw gridpoint data rather than /forecast/hourly because it gives wind
 * direction in degrees (not "NW"), gusts and sky cover, which the thermal model needs.
 * Then we pull the latest observation from the nearest station so the current hour
 * reflects what the wind is actually doing.
 */

export type FetchLike = (
  url: string,
  init?: { headers?: Record<string, string>; signal?: AbortSignal },
) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

export interface ProviderOptions {
  fetch?: FetchLike;
  signal?: AbortSignal;
  now?: Date;
  /**
   * Where to send NWS requests. Default is api.weather.gov directly (it allows CORS).
   * Set to "/api/nws" to go through server/index.mjs, which adds the User-Agent
   * NWS asks for and caches responses for every hunter on the same ground.
   */
  nwsBase?: string;
}

const NWS = 'https://api.weather.gov';
const HEADERS = { Accept: 'application/geo+json' };

async function getJson(f: FetchLike, url: string, signal?: AbortSignal, base = NWS): Promise<any> {
  // NWS hands back absolute api.weather.gov links; keep them on the proxy when there is one.
  const target = base !== NWS && url.startsWith(NWS) ? base + url.slice(NWS.length) : url;
  const res = await f(target, { headers: HEADERS, signal });
  if (!res.ok) throw new Error(`NWS ${res.status} for ${url}`);
  return res.json();
}

/** ISO 8601 duration ("PT1H", "P1DT6H") to hours. */
export function durationHours(d: string): number {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/.exec(d);
  if (!m) return 1;
  return Number(m[1] ?? 0) * 24 + Number(m[2] ?? 0) + Number(m[3] ?? 0) / 60;
}

interface Series {
  uom?: string;
  values?: { validTime: string; value: number | null }[];
}

function toMph(v: number, uom = ''): number {
  if (uom.endsWith('km_h-1')) return v * 0.621371;
  if (uom.endsWith('m_s-1')) return v * 2.23694;
  if (uom.endsWith('kt')) return v * 1.15078;
  return v;
}

function toF(v: number, uom = ''): number {
  return uom.endsWith('degF') ? v : (v * 9) / 5 + 32;
}

/** Expand a gridpoint series ("valid from T for PT3H") into a value per UTC hour. */
export function expandSeries(
  s: Series | undefined,
  convert: (v: number, uom?: string) => number = (v) => v,
): Map<number, number> {
  const out = new Map<number, number>();
  for (const { validTime, value } of s?.values ?? []) {
    if (value == null) continue;
    const [start, dur = 'PT1H'] = validTime.split('/');
    const t0 = Math.floor(Date.parse(start) / 3600e3) * 3600e3;
    const h = Math.max(1, Math.round(durationHours(dur)));
    const v = convert(value, s?.uom);
    for (let k = 0; k < h; k++) out.set(t0 + k * 3600e3, v);
  }
  return out;
}

export function parseGridData(props: any, windowStart: number, windowHours = 48): WeatherHour[] {
  const temp = expandSeries(props.temperature, toF);
  const wind = expandSeries(props.windSpeed, toMph);
  const gust = expandSeries(props.windGust, toMph);
  const dir = expandSeries(props.windDirection);
  const sky = expandSeries(props.skyCover);
  const rh = expandSeries(props.relativeHumidity);
  const dew = expandSeries(props.dewpoint, toF);
  const start = Math.floor(windowStart / 3600e3) * 3600e3;
  const hours: WeatherHour[] = [];
  for (let k = 0; k < windowHours; k++) {
    const t = start + k * 3600e3;
    const tempF = temp.get(t);
    const windMph = wind.get(t);
    const windFrom = dir.get(t);
    if (tempF == null || windMph == null || windFrom == null) continue;
    hours.push({
      at: new Date(t).toISOString(),
      tempF,
      windMph,
      windFrom,
      gustMph: gust.get(t),
      skyCoverPct: sky.get(t),
      humidityPct: rh.get(t),
      dewPointF: dew.get(t),
    });
  }
  return hours;
}

export function parseObservation(props: any, station: string): WeatherObservation | undefined {
  const t = props?.temperature;
  const w = props?.windSpeed;
  const d = props?.windDirection;
  if (!props?.timestamp || t?.value == null || w?.value == null) return undefined;
  const windMph = toMph(w.value, w.unitCode);
  // Calm reports come through with a null direction. Keep the forecast's direction then (weight handled by caller).
  if (d?.value == null && windMph > 1) return undefined;
  const g = props.windGust;
  const layers: { amount?: string }[] = props.cloudLayers ?? [];
  const okta: Record<string, number> = { SKC: 0, CLR: 0, FEW: 20, SCT: 45, BKN: 75, OVC: 100, VV: 100 };
  const sky = layers.length ? Math.max(...layers.map((l) => okta[l.amount ?? ''] ?? 0)) : undefined;
  return {
    station,
    at: new Date(props.timestamp).toISOString(),
    tempF: toF(t.value, t.unitCode),
    windMph,
    windFrom: d?.value ?? 0,
    gustMph: g?.value != null ? toMph(g.value, g.unitCode) : undefined,
    skyCoverPct: sky,
    humidityPct: props.relativeHumidity?.value ?? undefined,
    // Stations report pressure in Pa.
    pressureHpa: props.barometricPressure?.value != null ? props.barometricPressure.value / 100 : undefined,
    dewPointF: props.dewpoint?.value != null ? toF(props.dewpoint.value, props.dewpoint.unitCode) : undefined,
  };
}

/** Parse the coarse /forecast/hourly product. Fallback when gridData is down (it happens). */
export function parseHourlyForecast(props: any): WeatherHour[] {
  return (props?.periods ?? []).flatMap((p: any): WeatherHour[] => {
    const speeds =
      String(p.windSpeed ?? '')
        .match(/\d+/g)
        ?.map(Number) ?? [];
    const windFrom = compassToDegrees(String(p.windDirection ?? ''));
    if (!speeds.length || windFrom == null) return [];
    const tempF = p.temperatureUnit === 'C' ? (p.temperature * 9) / 5 + 32 : p.temperature;
    return [
      {
        at: new Date(p.startTime).toISOString(),
        tempF,
        windMph: speeds.reduce((a, b) => a + b, 0) / speeds.length,
        windFrom,
        humidityPct: p.relativeHumidity?.value ?? undefined,
      },
    ];
  });
}

export async function fetchNws(lat: number, lon: number, opts: ProviderOptions = {}): Promise<Forecast> {
  const f = opts.fetch ?? (globalThis.fetch as unknown as FetchLike);
  const now = opts.now ?? new Date();
  const base = opts.nwsBase ?? NWS;
  const get = (url: string) => getJson(f, url, opts.signal, base);
  const point = await get(`${NWS}/points/${lat.toFixed(4)},${lon.toFixed(4)}`);
  const pp = point?.properties ?? {};
  const windowStart = now.getTime() - 6 * 3600e3;

  let hours: WeatherHour[] = [];
  try {
    const grid = await get(pp.forecastGridData);
    hours = parseGridData(grid.properties, windowStart, 54);
  } catch (err) {
    if (!pp.forecastHourly) throw err;
  }
  if (hours.length < 6 && pp.forecastHourly) {
    const hourly = await get(pp.forecastHourly);
    hours = parseHourlyForecast(hourly.properties);
  }
  if (!hours.length) throw new Error('NWS returned no usable hours');

  let observed: WeatherObservation | undefined;
  try {
    const stations = await get(pp.observationStations);
    const id: string | undefined = stations?.features?.[0]?.properties?.stationIdentifier;
    if (id) {
      const obs = await get(`${NWS}/stations/${id}/observations/latest`);
      observed = parseObservation(obs?.properties, id);
      // An observation older than 2 hours is no better than the forecast.
      if (observed && now.getTime() - Date.parse(observed.at) > 2 * 3600e3) observed = undefined;
    }
  } catch {
    // Observations are a bonus. The forecast stands on its own.
  }

  return {
    source: 'nws',
    lat,
    lon,
    fetchedAt: now.toISOString(),
    timeZone: pp.timeZone,
    hours,
    observed,
  };
}
