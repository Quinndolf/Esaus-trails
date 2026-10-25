import type { FetchLike, ProviderOptions } from './nws';
import type { Forecast, WeatherHour } from './types';

/**
 * Open-Meteo: free, no key, worldwide, CORS-friendly. Used outside the US and
 * whenever the NWS is down. Its "current" block is a model nowcast, not a station,
 * so we treat it as a light correction only.
 */
const HOURLY = 'temperature_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,cloud_cover,relative_humidity_2m,surface_pressure,dew_point_2m';

export function openMeteoUrl(lat: number, lon: number): string {
  const q = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    hourly: HOURLY,
    current: HOURLY,
    wind_speed_unit: 'mph',
    temperature_unit: 'fahrenheit',
    timezone: 'auto',
    timeformat: 'unixtime',
    past_hours: '6',
    forecast_hours: '48',
  });
  return `https://api.open-meteo.com/v1/forecast?${q}`;
}

export function parseOpenMeteo(body: any, lat: number, lon: number, now: Date): Forecast {
  const h = body?.hourly ?? {};
  const time: number[] = h.time ?? [];
  const hours: WeatherHour[] = [];
  time.forEach((t, k) => {
    const tempF = h.temperature_2m?.[k];
    const windMph = h.wind_speed_10m?.[k];
    const windFrom = h.wind_direction_10m?.[k];
    if (tempF == null || windMph == null || windFrom == null) return;
    hours.push({
      at: new Date(t * 1000).toISOString(),
      tempF,
      windMph,
      windFrom,
      gustMph: h.wind_gusts_10m?.[k] ?? undefined,
      skyCoverPct: h.cloud_cover?.[k] ?? undefined,
      humidityPct: h.relative_humidity_2m?.[k] ?? undefined,
      pressureHpa: h.surface_pressure?.[k] ?? undefined,
      dewPointF: h.dew_point_2m?.[k] ?? undefined,
    });
  });
  const c = body?.current;
  const observed =
    c && c.wind_speed_10m != null && c.wind_direction_10m != null && c.temperature_2m != null
      ? {
          station: 'open-meteo nowcast',
          at: new Date(c.time * 1000).toISOString(),
          tempF: c.temperature_2m,
          windMph: c.wind_speed_10m,
          windFrom: c.wind_direction_10m,
          gustMph: c.wind_gusts_10m ?? undefined,
          skyCoverPct: c.cloud_cover ?? undefined,
          humidityPct: c.relative_humidity_2m ?? undefined,
          pressureHpa: c.surface_pressure ?? undefined,
          dewPointF: c.dew_point_2m ?? undefined,
        }
      : undefined;
  return {
    source: 'open-meteo',
    lat,
    lon,
    fetchedAt: now.toISOString(),
    timeZone: body?.timezone,
    hours,
    observed,
  };
}

export async function fetchOpenMeteo(lat: number, lon: number, opts: ProviderOptions = {}): Promise<Forecast> {
  const f = opts.fetch ?? (globalThis.fetch as unknown as FetchLike);
  const res = await f(openMeteoUrl(lat, lon), { signal: opts.signal });
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const fc = parseOpenMeteo(await res.json(), lat, lon, opts.now ?? new Date());
  if (!fc.hours.length) throw new Error('Open-Meteo returned no usable hours');
  return fc;
}
