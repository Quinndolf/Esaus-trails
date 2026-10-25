import { describe, expect, it } from 'vitest';
import { getForecast, memoryCache } from '../forecast';
import { durationHours, expandSeries, fetchNws, parseHourlyForecast, type FetchLike } from '../nws';
import { openMeteoUrl, parseOpenMeteo } from '../openMeteo';
import { weatherAt } from '../weather';
import type { Forecast } from '../types';
import { hour, steadyForecast } from './fixtures';

const NOW = new Date('2026-10-25T14:20:00Z');

// Trimmed shapes of real api.weather.gov responses.
const POINT = {
  properties: {
    forecastGridData: 'https://api.weather.gov/gridpoints/LMK/50,60',
    forecastHourly: 'https://api.weather.gov/gridpoints/LMK/50,60/forecast/hourly',
    observationStations: 'https://api.weather.gov/gridpoints/LMK/50,60/stations',
    timeZone: 'America/Kentucky/Louisville',
  },
};
const GRID = {
  properties: {
    temperature: {
      uom: 'wmoUnit:degC',
      values: [
        { validTime: '2026-10-25T08:00:00+00:00/PT12H', value: 10 },
        { validTime: '2026-10-25T20:00:00+00:00/P1DT12H', value: 5 },
      ],
    },
    windSpeed: { uom: 'wmoUnit:km_h-1', values: [{ validTime: '2026-10-25T08:00:00+00:00/P2D', value: 16.0934 }] },
    windGust: { uom: 'wmoUnit:km_h-1', values: [{ validTime: '2026-10-25T08:00:00+00:00/P2D', value: 32.1869 }] },
    windDirection: {
      uom: 'wmoUnit:degree_(angle)',
      values: [
        { validTime: '2026-10-25T08:00:00+00:00/PT10H', value: 315 },
        { validTime: '2026-10-25T18:00:00+00:00/P1DT14H', value: 200 },
      ],
    },
    skyCover: { uom: 'wmoUnit:percent', values: [{ validTime: '2026-10-25T08:00:00+00:00/P2D', value: 20 }] },
    relativeHumidity: { uom: 'wmoUnit:percent', values: [{ validTime: '2026-10-25T08:00:00+00:00/P2D', value: 70 }] },
  },
};
const STATIONS = { features: [{ properties: { stationIdentifier: 'KBRY' } }] };
const OBS = {
  properties: {
    timestamp: '2026-10-25T13:55:00+00:00',
    temperature: { unitCode: 'wmoUnit:degC', value: 12 },
    windSpeed: { unitCode: 'wmoUnit:km_h-1', value: 24.14 },
    windDirection: { unitCode: 'wmoUnit:degree_(angle)', value: 290 },
    windGust: { unitCode: 'wmoUnit:km_h-1', value: null },
    relativeHumidity: { value: 60 },
    cloudLayers: [{ amount: 'FEW' }, { amount: 'BKN' }],
  },
};

function mockFetch(routes: Record<string, unknown>, seen: string[] = []): FetchLike {
  return async (url) => {
    seen.push(url);
    const key = Object.keys(routes).find((k) => url.endsWith(k));
    if (!key) return { ok: false, status: 404, json: async () => ({}) };
    const body = routes[key];
    if (body instanceof Error) return { ok: false, status: 500, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => body };
  };
}

const NWS_ROUTES = {
  '/points/37.5000,-85.5000': POINT,
  '/gridpoints/LMK/50,60': GRID,
  '/gridpoints/LMK/50,60/stations': STATIONS,
  '/stations/KBRY/observations/latest': OBS,
};

describe('NWS', () => {
  it('parses ISO durations', () => {
    expect(durationHours('PT1H')).toBe(1);
    expect(durationHours('PT3H')).toBe(3);
    expect(durationHours('P1DT6H')).toBe(30);
    expect(durationHours('P2D')).toBe(48);
  });

  it('expands a gridpoint series hour by hour', () => {
    const m = expandSeries({ values: [{ validTime: '2026-10-25T08:00:00+00:00/PT3H', value: 7 }] });
    expect([...m.values()]).toEqual([7, 7, 7]);
  });

  it("fetches gridpoint wind in degrees and mph, plus the station's latest", async () => {
    const fc = await fetchNws(37.5, -85.5, { fetch: mockFetch(NWS_ROUTES), now: NOW });
    expect(fc.source).toBe('nws');
    expect(fc.timeZone).toBe('America/Kentucky/Louisville');
    const h = fc.hours.find((x) => x.at === '2026-10-25T14:00:00.000Z')!;
    expect(h.windMph).toBeCloseTo(10, 1);
    expect(h.gustMph).toBeCloseTo(20, 1);
    expect(h.windFrom).toBe(315);
    expect(h.tempF).toBeCloseTo(50, 5);
    expect(h.skyCoverPct).toBe(20);
    expect(fc.hours.find((x) => x.at === '2026-10-25T19:00:00.000Z')!.windFrom).toBe(200);
    expect(fc.observed?.station).toBe('KBRY');
    expect(fc.observed?.windMph).toBeCloseTo(15, 0);
    expect(fc.observed?.windFrom).toBe(290);
    expect(fc.observed?.skyCoverPct).toBe(75);
  });

  it('keeps requests on the proxy when one is set', async () => {
    const seen: string[] = [];
    await fetchNws(37.5, -85.5, { fetch: mockFetch(NWS_ROUTES, seen), now: NOW, nwsBase: '/api/nws' });
    expect(seen.every((u) => u.startsWith('/api/nws/'))).toBe(true);
    expect(seen).toContain('/api/nws/gridpoints/LMK/50,60');
  });

  it('falls back to the hourly product when gridpoint data fails', async () => {
    const hourly = {
      properties: {
        periods: [
          {
            startTime: '2026-10-25T10:00:00-04:00',
            temperature: 52,
            temperatureUnit: 'F',
            windSpeed: '5 to 10 mph',
            windDirection: 'NW',
          },
          {
            startTime: '2026-10-25T11:00:00-04:00',
            temperature: 54,
            temperatureUnit: 'F',
            windSpeed: '10 mph',
            windDirection: 'WNW',
          },
        ],
      },
    };
    const fc = await fetchNws(37.5, -85.5, {
      fetch: mockFetch({ ...NWS_ROUTES, '/gridpoints/LMK/50,60': new Error(), '/forecast/hourly': hourly }),
      now: NOW,
    });
    expect(fc.hours).toHaveLength(2);
    expect(fc.hours[0]).toMatchObject({ at: '2026-10-25T14:00:00.000Z', windMph: 7.5, windFrom: 315 });
    expect(parseHourlyForecast({ periods: [{ windSpeed: 'calm', windDirection: '' }] })).toEqual([]);
  });

  it('ignores a stale station report', async () => {
    const old = { properties: { ...OBS.properties, timestamp: '2026-10-25T09:00:00+00:00' } };
    const fc = await fetchNws(37.5, -85.5, {
      fetch: mockFetch({ ...NWS_ROUTES, '/stations/KBRY/observations/latest': old }),
      now: NOW,
    });
    expect(fc.observed).toBeUndefined();
  });
});

describe('Open-Meteo', () => {
  it('builds a keyless mph/F request and parses it', () => {
    const url = openMeteoUrl(37.5, -85.5);
    expect(url).toContain('wind_speed_unit=mph');
    expect(url).toContain('temperature_unit=fahrenheit');
    const t = Date.parse('2026-10-25T14:00:00Z') / 1000;
    const fc = parseOpenMeteo(
      {
        timezone: 'America/New_York',
        hourly: {
          time: [t, t + 3600],
          temperature_2m: [50, 52],
          wind_speed_10m: [6, 8],
          wind_direction_10m: [180, 190],
          wind_gusts_10m: [12, 14],
          cloud_cover: [10, 30],
          relative_humidity_2m: [70, 65],
        },
        current: {
          time: t + 600,
          temperature_2m: 51,
          wind_speed_10m: 7,
          wind_direction_10m: 185,
          wind_gusts_10m: 13,
          cloud_cover: 15,
        },
      },
      37.5,
      -85.5,
      NOW,
    );
    expect(fc.hours[1]).toMatchObject({ at: '2026-10-25T15:00:00.000Z', windMph: 8, windFrom: 190, skyCoverPct: 30 });
    expect(fc.observed?.station).toBe('open-meteo nowcast');
  });
});

describe('getForecast', () => {
  const good: Forecast = { ...steadyForecast({ windMph: 5 }), fetchedAt: NOW.toISOString() };

  it('serves a fresh cache without touching the network', async () => {
    const cache = memoryCache();
    cache.set('37.50,-85.50', good);
    let called = 0;
    const fc = await getForecast(37.5, -85.5, { cache, now: NOW, providers: [async () => (called++, good)] });
    expect(called).toBe(0);
    expect(fc.stale).toBe(false);
  });

  it('tries the next provider when the first fails, and caches the result', async () => {
    const cache = memoryCache();
    const fc = await getForecast(37.5, -85.5, {
      cache,
      now: NOW,
      providers: [
        async () => {
          throw new Error('NWS 503');
        },
        async () => ({ ...good, source: 'open-meteo' }),
      ],
    });
    expect(fc.source).toBe('open-meteo');
    expect(await cache.get('37.50,-85.50')).toBeDefined();
  });

  it('falls back to an old cached forecast, marked stale, with no signal', async () => {
    const cache = memoryCache();
    cache.set('37.50,-85.50', { ...good, fetchedAt: '2026-10-24T08:00:00Z' });
    const fc = await getForecast(37.5, -85.5, {
      cache,
      now: NOW,
      providers: [
        async () => {
          throw new Error('offline');
        },
      ],
    });
    expect(fc.stale).toBe(true);
    await expect(
      getForecast(10, 10, {
        cache,
        now: NOW,
        providers: [
          async () => {
            throw new Error('offline');
          },
        ],
      }),
    ).rejects.toThrow(/offline/);
  });
});

describe('weatherAt', () => {
  const fc: Forecast = {
    ...steadyForecast(),
    hours: [
      hour('2026-10-25T14:00:00.000Z', { windFrom: 350, windMph: 6, tempF: 50 }),
      hour('2026-10-25T15:00:00.000Z', { windFrom: 10, windMph: 10, tempF: 54 }),
    ],
  };

  it('interpolates between hours, turning the short way through north', () => {
    const w = weatherAt(fc, new Date('2026-10-25T14:30:00Z'));
    expect(w.tempF).toBeCloseTo(52);
    expect(w.windMph).toBeCloseTo(8);
    expect(Math.min(w.windFrom, 360 - w.windFrom)).toBeLessThan(5);
    expect(w.extrapolated).toBe(false);
  });

  it('holds the ends and flags times outside the forecast', () => {
    expect(weatherAt(fc, new Date('2026-10-25T20:00:00Z')).extrapolated).toBe(true);
  });

  it('leans on a fresh observation near now and lets it fade', () => {
    const withObs: Forecast = {
      ...fc,
      observed: { ...hour('2026-10-25T14:30:00.000Z', { windMph: 20, windFrom: 0 }), station: 'KBRY' },
    };
    const now = weatherAt(withObs, new Date('2026-10-25T14:30:00Z'));
    expect(now.observedWeight).toBeGreaterThan(0.8);
    expect(now.windMph).toBeGreaterThan(17);
    const later = weatherAt(withObs, new Date('2026-10-25T18:00:00Z'));
    expect(later.observedWeight).toBe(0);
  });
});
