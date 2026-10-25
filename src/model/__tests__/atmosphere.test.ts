import { describe, expect, it } from 'vitest';
import { atmosphereAt, frontPassage, moonPhase, pressureTrend, pressureWord } from '../atmosphere';
import { computeThermals } from '../thermal';
import { analyzeTerrain } from '../terrain';
import { sunPosition, sunTimes } from '../sun';
import { weatherAt } from '../weather';
import { parseGridData, parseObservation } from '../nws';
import { parseOpenMeteo } from '../openMeteo';
import type { Forecast } from '../types';
import { CENTER, KY_11AM, hollow, hour } from './fixtures';

const T0 = Date.parse('2026-10-25T00:00:00Z');
const iso = (k: number) => new Date(T0 + k * 3600e3).toISOString();

/** Warm southwest air and falling pressure, a front at hour 24, then cold northwest air and rising pressure. */
function frontForecast(): Forecast {
  return {
    source: 'open-meteo',
    lat: 37.5,
    lon: -85.5,
    fetchedAt: iso(0),
    hours: Array.from({ length: 48 }, (_, k) => {
      const after = k >= 24;
      const ramp = Math.min(1, Math.max(0, (k - 21) / 6));
      return hour(iso(k), {
        tempF: 68 - 22 * ramp,
        windMph: 8,
        windFrom: 225 + 90 * ramp,
        pressureHpa: after ? 1000 + (k - 24) * 0.8 : 1010 - k * 0.45,
        dewPointF: after ? 30 : 58,
      });
    }),
  };
}

describe('moon', () => {
  it('knows a known full moon and new moon', () => {
    // Full moon 2026-10-26 ~04:12 UTC; new moon 2026-11-09 ~ 07:02 UTC.
    expect(moonPhase(new Date('2026-10-26T04:00:00Z')).name).toBe('full moon');
    expect(moonPhase(new Date('2026-10-26T04:00:00Z')).illumination).toBeGreaterThan(0.98);
    expect(moonPhase(new Date('2026-11-09T07:00:00Z')).illumination).toBeLessThan(0.02);
  });
});

describe('pressure trend', () => {
  it('names the change over three hours', () => {
    expect(pressureWord(-4)).toBe('rapidly falling');
    expect(pressureWord(-1.5)).toBe('falling');
    expect(pressureWord(0.3)).toBe('steady');
    expect(pressureWord(2)).toBe('rising');
  });
  it('reads the forecast and says nothing when there is no pressure', () => {
    const f = frontForecast();
    const t = pressureTrend(f, new Date(T0 + 10 * 3600e3));
    expect(t.word).toBe('falling');
    expect(t.change3h).toBeCloseTo(-1.35, 1);
    const none = { ...f, hours: f.hours.map((h) => ({ ...h, pressureHpa: undefined })) };
    expect(pressureTrend(none, new Date(T0 + 10 * 3600e3)).word).toBeNull();
  });
});

describe('front passage', () => {
  it('sees a front coming, passing, and gone', () => {
    const f = frontForecast();
    const ahead = frontPassage(f, new Date(T0 + 12 * 3600e3));
    expect(ahead.state).toBe('approaching');
    expect(ahead.hoursFromNow).toBeGreaterThan(6);
    expect(frontPassage(f, new Date(T0 + 24 * 3600e3)).state).toBe('passing');
    expect(frontPassage(f, new Date(T0 + 40 * 3600e3)).state).toBe('passed');
  });
  it('ignores steady weather', () => {
    const steady: Forecast = { ...frontForecast(), hours: Array.from({ length: 48 }, (_, k) => hour(iso(k), { tempF: 50 })) };
    expect(frontPassage(steady, new Date(T0 + 20 * 3600e3)).state).toBe('none');
  });
});

describe('atmosphere', () => {
  it('writes one line and nudges movement ahead of a front', () => {
    const a = atmosphereAt(frontForecast(), new Date(T0 + 16 * 3600e3));
    expect(a.line).toMatch(/Barometer falling/);
    expect(a.line).toMatch(/cold front/);
    expect(a.line).toMatch(/Moon:/);
    expect(a.movementFactor).toBeGreaterThan(1);
    expect(a.movementFactor).toBeLessThan(1.3);
  });
  it('calls fog when the air sits on its dew point and is calm', () => {
    const f: Forecast = { ...frontForecast(), hours: Array.from({ length: 48 }, (_, k) => hour(iso(k), { tempF: 41, dewPointF: 40, windMph: 1 })) };
    const a = atmosphereAt(f, new Date(T0 + 10 * 3600e3));
    expect(a.fog).toBe(true);
    expect(a.line).toMatch(/fog/);
  });
});

describe('weather providers', () => {
  it('keeps the forecast pressure when blending a station observation', () => {
    const f = frontForecast();
    f.observed = { ...f.hours[10], station: 'KXYZ', pressureHpa: 900 };
    expect(weatherAt(f, new Date(T0 + 10 * 3600e3)).pressureHpa).toBeCloseTo(f.hours[10].pressureHpa!, 3);
  });
  it('reads pressure and dew point from Open-Meteo', () => {
    const fc = parseOpenMeteo(
      { hourly: { time: [T0 / 1000], temperature_2m: [50], wind_speed_10m: [5], wind_direction_10m: [200], surface_pressure: [1008.2], dew_point_2m: [44] } },
      37.5,
      -85.5,
      new Date(T0),
    );
    expect(fc.hours[0].pressureHpa).toBe(1008.2);
    expect(fc.hours[0].dewPointF).toBe(44);
  });
  it('reads dew point from NWS gridpoints and pressure (Pa) from a station', () => {
    const props = {
      temperature: { uom: 'wmoUnit:degC', values: [{ validTime: '2026-10-25T00:00:00+00:00/PT2H', value: 10 }] },
      windSpeed: { uom: 'wmoUnit:km_h-1', values: [{ validTime: '2026-10-25T00:00:00+00:00/PT2H', value: 10 }] },
      windDirection: { values: [{ validTime: '2026-10-25T00:00:00+00:00/PT2H', value: 200 }] },
      dewpoint: { uom: 'wmoUnit:degC', values: [{ validTime: '2026-10-25T00:00:00+00:00/PT2H', value: 5 }] },
    };
    expect(parseGridData(props, T0, 2)[0].dewPointF).toBeCloseTo(41, 5);
    const obs = parseObservation(
      { timestamp: iso(0), temperature: { value: 10, unitCode: 'wmoUnit:degC' }, windSpeed: { value: 10, unitCode: 'wmoUnit:km_h-1' }, windDirection: { value: 200 }, barometricPressure: { value: 101250 }, dewpoint: { value: 5, unitCode: 'wmoUnit:degC' } },
      'KXYZ',
    );
    expect(obs?.pressureHpa).toBeCloseTo(1012.5, 5);
    expect(obs?.dewPointF).toBeCloseTo(41, 5);
  });
});

describe('thermals and humidity', () => {
  it('a foggy calm night pools cold air harder than a dry one', () => {
    const t = analyzeTerrain(hollow(0.3));
    const date = new Date('2026-10-25T06:00:00Z');
    const mk = (dewPointF: number) => {
      const weather = { ...hour(date.toISOString(), { tempF: 41, windMph: 1, dewPointF, skyCoverPct: 0 }), extrapolated: false, observedWeight: 0 };
      const sun = sunPosition(date, CENTER[1], CENTER[0]);
      return computeThermals(t, { date, sun, sunTimes: sunTimes(KY_11AM, CENTER[1], CENTER[0]), weather } as any);
    };
    const sum = (a: ArrayLike<number>) => Array.from(a).reduce((x, y) => x + y, 0);
    expect(sum(mk(40).strength)).toBeGreaterThan(0);
    expect(sum(mk(15).strength)).toBeGreaterThan(sum(mk(55).strength)); // dry clear night cools more than a muggy one
  });
});
