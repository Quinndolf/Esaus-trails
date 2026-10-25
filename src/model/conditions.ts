import { atmosphereAt, type Atmosphere } from './atmosphere';
import { cardinal, cellAt, compassWord, gridCenter, M_TO_FT, type LngLat } from './geo';
import { DRIVER_WORDS, hourSummary, thermalLine, THERMAL_WORDS, windLine } from './describe';
import { computeScent, tracePlume, type Plume, type ScentField } from './scent';
import { sunPosition, sunTimes } from './sun';
import { analyzeTerrain, type Terrain } from './terrain';
import { computeThermals, type DayPhase, type ThermalField } from './thermal';
import { sliderHours, weatherAt, type WeatherAt } from './weather';
import { computeWind, type WindField } from './wind';
import type { ElevationGrid, Forecast, SunPosition, SunTimes } from './types';

/**
 * The entry point for the map and the hour slider. Build once per analyzed grid
 * and forecast, then call `at(date)` as the slider moves. Each hour is computed
 * once and kept, so scrubbing back and forth is free.
 */

export interface HourConditions {
  date: Date;
  weather: WeatherAt;
  sun: SunPosition;
  sunTimes: SunTimes;
  phase: DayPhase;
  thermal: ThermalField;
  wind: WindField;
  scent: ScentField;
  /** Pressure trend, front passage, dew point, cloud and moon for this hour. */
  atmosphere: Atmosphere;
  /** One line for the whole ground this hour. */
  summary: string;
}

export interface PointReading {
  inGrid: boolean;
  elevationFt: number | null;
  slopeDeg: number | null;
  /** Direction the ground faces, or null on flat ground. */
  facing: number | null;
  terrainWord: string;
  thermal: { state: (typeof THERMAL_WORDS)[number]; strength: number; flowBearing: number | null; line: string };
  wind: { fromDeg: number; mph: number; sheltered: boolean; eddy: boolean; line: string };
  scent: { towardDeg: number; mph: number; driver: string; reachYards: number; plume: Plume | null };
  summary: string;
  /**
   * Compact, factual paragraph for Esau's prompt. He always gets position, ground,
   * wind and thermals; this is that, for one spot and one hour.
   */
  brief: string;
}

export interface ConditionsModel {
  terrain: Terrain;
  forecast: Forecast;
  /** Hour stamps for the slider, starting at the current hour. */
  hours(count?: number, from?: Date): Date[];
  at(date: Date): HourConditions;
  read(point: LngLat, date: Date): PointReading;
}

function terrainWord(t: Terrain, i: number): string {
  const pos = t.position[i];
  const slope = t.slopeDeg[i];
  if (t.drainage[i] > 0.6 && pos < 0) return 'draw bottom';
  if (pos > 0.45) return slope < 6 ? 'ridge top' : 'ridge shoulder';
  if (pos < -0.45) return 'hollow';
  if (slope < 3) return 'flat';
  if (slope < 8) return 'gentle slope';
  if (slope < 16) return 'sidehill bench';
  if (slope < 26) return 'steep sidehill';
  return 'severe slope';
}

export function createConditionsModel(
  grid: ElevationGrid,
  forecast: Forecast,
  opts: { keepHours?: number } = {},
): ConditionsModel {
  const terrain = analyzeTerrain(grid);
  const [lng, lat] = gridCenter(grid);
  const keep = opts.keepHours ?? 72;
  const memo = new Map<number, HourConditions>();

  function at(date: Date): HourConditions {
    const key = Math.round(date.getTime() / 60e3);
    const hit = memo.get(key);
    if (hit) return hit;
    const weather = weatherAt(forecast, date);
    const sun = sunPosition(date, lat, lng);
    const times = sunTimes(date, lat, lng);
    const thermal = computeThermals(terrain, { date, sun, sunTimes: times, weather });
    const wind = computeWind(terrain, weather);
    const scent = computeScent(terrain, wind, thermal, weather);
    const hc: HourConditions = {
      date,
      weather,
      sun,
      sunTimes: times,
      phase: thermal.phase,
      thermal,
      wind,
      scent,
      atmosphere: atmosphereAt(forecast, date, { isNight: sun.altitude < -0.833 }),
      summary: hourSummary(thermal, weather, sun),
    };
    if (memo.size >= keep) memo.delete(memo.keys().next().value as number);
    memo.set(key, hc);
    return hc;
  }

  function read(point: LngLat, date: Date): PointReading {
    const hc = at(date);
    const i = cellAt(grid, point);
    const wl = windLine(hc.weather);
    if (i == null) {
      return {
        inGrid: false,
        elevationFt: null,
        slopeDeg: null,
        facing: null,
        terrainWord: 'outside the plotted ground',
        thermal: { state: 'Settled', strength: 0, flowBearing: null, line: 'Read this ground first.' },
        wind: { fromDeg: hc.weather.windFrom, mph: hc.weather.windMph, sheltered: false, eddy: false, line: wl },
        scent: {
          towardDeg: (hc.weather.windFrom + 180) % 360,
          mph: hc.weather.windMph * 0.55,
          driver: 'wind',
          reachYards: 0,
          plume: null,
        },
        summary: hc.summary,
        brief: `${wl} ${hc.summary} ${hc.atmosphere.line} This spot is outside the analyzed ground, so no terrain read.`,
      };
    }
    const elevationFt = Math.round((grid.elevationM[i] * M_TO_FT) / 5) * 5;
    const slopeDeg = Math.round(terrain.slopeDeg[i]);
    const facing =
      Number.isFinite(terrain.aspectDeg[i]) && terrain.slopeDeg[i] >= 2 ? Math.round(terrain.aspectDeg[i]) : null;
    const tw = terrainWord(terrain, i);
    const st = hc.thermal.state[i];
    const flow = hc.thermal.flowBearing[i];
    const plume = tracePlume(terrain, hc.scent, point);
    const towardDeg = Math.round(hc.scent.driftBearing[i]);
    const driver = DRIVER_WORDS[hc.scent.driver[i] as 0 | 1 | 2];
    const tline = thermalLine(st, hc.thermal.strength[i], hc.weather);
    const sheltered = hc.wind.sheltered[i] === 1;
    const eddy = hc.wind.eddy[i] === 1;

    const ground = `${elevationFt} ft, ${tw}, ${slopeDeg}° slope${facing != null ? ` facing ${compassWord(facing)}` : ''}.`;
    const air =
      `Thermal: ${THERMAL_WORDS[st].toLowerCase()}${st ? ` (${Math.round(hc.thermal.strength[i] * 100)}%)` : ''}. ${
        eddy
          ? 'Steep lee side: expect the wind to eddy and curl back.'
          : sheltered
            ? 'Sheltered from the wind here.'
            : ''
      }`.trim();
    const smell =
      driver === 'swirling'
        ? `Scent swirls here; it can go any direction.`
        : `Scent drifts ${compassWord(towardDeg)} about ${Math.round(plume.reachYards / 10) * 10} yards, driven by ${driver}.`;
    const sunWord =
      hc.sun.altitude < -0.833
        ? 'Sun is down.'
        : `Sun ${Math.round(hc.sun.altitude)}° up in the ${cardinal(hc.sun.azimuth)}.`;
    const stale = forecast.stale ? ' Weather is from an old download; no signal.' : '';

    return {
      inGrid: true,
      elevationFt,
      slopeDeg,
      facing,
      terrainWord: tw,
      thermal: {
        state: THERMAL_WORDS[st],
        strength: hc.thermal.strength[i],
        flowBearing: Number.isFinite(flow) ? Math.round(flow) : null,
        line: tline,
      },
      wind: { fromDeg: Math.round(hc.wind.fromDeg[i]), mph: hc.wind.mph[i], sheltered, eddy, line: wl },
      scent: { towardDeg, mph: hc.scent.driftMph[i], driver, reachYards: plume.reachYards, plume },
      summary: hc.summary,
      brief:
        `${Math.round(hc.weather.tempF)}°F. ${wl} ${sunWord} ${hc.summary} ${hc.atmosphere.line} At this spot: ${ground} ${air} ${smell}${stale}`.replace(
          /\s+/g,
          ' ',
        ),
    };
  }

  return { terrain, forecast, at, read, hours: (count = 24, from = new Date()) => sliderHours(forecast, from, count) };
}
