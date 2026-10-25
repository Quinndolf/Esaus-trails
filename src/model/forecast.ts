import { fetchNws, type ProviderOptions } from './nws';
import { fetchOpenMeteo } from './openMeteo';
import type { Forecast } from './types';

/** Where forecasts are kept between fetches. The app can back this with IndexedDB or localStorage. */
export interface ForecastCache {
  get(key: string): Promise<Forecast | undefined> | Forecast | undefined;
  set(key: string, value: Forecast): Promise<void> | void;
}

export function memoryCache(): ForecastCache {
  const m = new Map<string, Forecast>();
  return { get: (k) => m.get(k), set: (k, v) => void m.set(k, v) };
}

/** A cache over any Storage-like object (window.localStorage). Errors are swallowed: storage is a convenience. */
export function storageCache(storage: Pick<Storage, 'getItem' | 'setItem'>, prefix = 'esau.forecast.'): ForecastCache {
  return {
    get(k) {
      try {
        const raw = storage.getItem(prefix + k);
        return raw ? (JSON.parse(raw) as Forecast) : undefined;
      } catch {
        return undefined;
      }
    },
    set(k, v) {
      try {
        storage.setItem(prefix + k, JSON.stringify(v));
      } catch {
        // full or blocked
      }
    },
  };
}

/** Forecasts are shared across about a kilometer; NWS grid cells are 2.5 km anyway. */
export const forecastKey = (lat: number, lon: number) => `${lat.toFixed(2)},${lon.toFixed(2)}`;

export interface GetForecastOptions extends ProviderOptions {
  cache?: ForecastCache;
  /** Minutes a cached forecast counts as fresh. Default 45. */
  maxAgeMin?: number;
  /** Provider order. Default NWS first, then Open-Meteo. */
  providers?: ((lat: number, lon: number, o: ProviderOptions) => Promise<Forecast>)[];
}

/**
 * Get wind and weather for a spot. Fresh cache, then each provider in turn, then a
 * stale cache marked `stale: true` so the app can tell the hunter the read is old.
 * Throws only when there is nothing at all.
 */
export async function getForecast(lat: number, lon: number, opts: GetForecastOptions = {}): Promise<Forecast> {
  const now = opts.now ?? new Date();
  const key = forecastKey(lat, lon);
  const cached = opts.cache ? await opts.cache.get(key) : undefined;
  const maxAge = (opts.maxAgeMin ?? 45) * 60e3;
  if (cached && now.getTime() - Date.parse(cached.fetchedAt) < maxAge) return { ...cached, stale: false };

  const providers = opts.providers ?? [fetchNws, fetchOpenMeteo];
  const errors: string[] = [];
  for (const p of providers) {
    try {
      const fc = await p(lat, lon, { fetch: opts.fetch, signal: opts.signal, now, nwsBase: opts.nwsBase });
      if (opts.cache) await opts.cache.set(key, fc);
      return fc;
    } catch (err) {
      if (opts.signal?.aborted) throw err;
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }
  if (cached) return { ...cached, stale: true };
  throw new Error(`No weather for this spot: ${errors.join('; ')}`);
}
