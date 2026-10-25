import { clamp, smoothstep } from './geo';
import { weatherAt } from './weather';
import type { Forecast } from './types';

/**
 * Weather beyond wind and temperature: pressure trend, front passage, dew point, cloud and moon.
 * Pure functions over the forecast. Thresholds are this app's own rules of thumb, not published
 * standards; the research behind them is in src/esau/species/abiotic.ts and says how weak some of it is.
 */

export type PressureWord = 'rapidly falling' | 'falling' | 'steady' | 'rising' | 'rapidly rising';

export interface PressureTrend {
  hpa: number;
  /** Change over the last 3 hours, hPa. Null when the forecast carries no pressure. */
  change3h: number | null;
  word: PressureWord | null;
}

export type FrontState = 'none' | 'approaching' | 'passing' | 'passed';

export interface Front {
  state: FrontState;
  /** Cold front (temperature falls, wind veers) or unclear. Only cold fronts are called. */
  kind: 'cold' | 'unclear' | null;
  /** Hours until (positive) or since (negative) the front, at its center. */
  hoursFromNow: number | null;
}

export interface Moon {
  /** 0 new, 0.25 first quarter, 0.5 full, 0.75 last quarter. */
  phase: number;
  /** 0-1 lit fraction. */
  illumination: number;
  name: string;
}

export interface Atmosphere {
  pressure: PressureTrend;
  front: Front;
  dewPointF: number | null;
  /** Air temperature minus dew point, °F. Under about 4 the air is nearly saturated. */
  spreadF: number | null;
  fog: boolean;
  cloudPct: number | null;
  moon: Moon;
  /** Multiplier on how much deer are on their feet this hour. Small on purpose. */
  movementFactor: number;
  /** One factual paragraph for Esau and the hour panel. */
  line: string;
}

const SYNODIC = 29.530588853;
// A known new moon: 2000-01-06 18:14 UTC.
const NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);

const MOON_NAMES = [
  'new moon',
  'waxing crescent',
  'first quarter',
  'waxing gibbous',
  'full moon',
  'waning gibbous',
  'last quarter',
  'waning crescent',
];

/** Mean-lunation moon phase. Good to about half a day, plenty for hunting. */
export function moonPhase(date: Date): Moon {
  const days = (date.getTime() - NEW_MOON) / 864e5;
  const phase = (((days / SYNODIC) % 1) + 1) % 1;
  const illumination = (1 - Math.cos(2 * Math.PI * phase)) / 2;
  const name = MOON_NAMES[Math.round(phase * 8) % 8];
  return { phase, illumination, name };
}

export function pressureWord(change3h: number): PressureWord {
  if (change3h <= -3) return 'rapidly falling';
  if (change3h <= -1) return 'falling';
  if (change3h >= 3) return 'rapidly rising';
  if (change3h >= 1) return 'rising';
  return 'steady';
}

export function pressureTrend(forecast: Forecast, date: Date): PressureTrend {
  const now = weatherAt(forecast, date).pressureHpa;
  const before = weatherAt(forecast, new Date(date.getTime() - 3 * 3600e3)).pressureHpa;
  if (now == null) return { hpa: NaN, change3h: null, word: null };
  if (before == null) return { hpa: now, change3h: null, word: null };
  const change3h = now - before;
  return { hpa: now, change3h, word: pressureWord(change3h) };
}

const angleDiff = (a: number, b: number) => ((((b - a) % 360) + 540) % 360) - 180;

/**
 * Look for a cold front in the hours around `date`: wind veers a quarter turn or more clockwise
 * (southwest to northwest) within about six hours while the temperature drops. Reads only the
 * forecast hours it has, so near the edge of the forecast it can miss one.
 */
export function frontPassage(forecast: Forecast, date: Date): Front {
  const t = date.getTime();
  let best: { k: number; score: number; kind: 'cold' | 'unclear' } | null = null;
  for (let k = -24; k <= 24; k++) {
    const mid = t + k * 3600e3;
    const a = weatherAt(forecast, new Date(mid - 3 * 3600e3));
    const b = weatherAt(forecast, new Date(mid + 3 * 3600e3));
    if (a.extrapolated || b.extrapolated) continue;
    const veer = angleDiff(a.windFrom, b.windFrom); // + clockwise
    const drop = a.tempF - b.tempF;
    const rise = a.pressureHpa != null && b.pressureHpa != null ? b.pressureHpa - a.pressureHpa : 0;
    if (veer >= 60 && drop >= 4) {
      const score = veer / 90 + drop / 10 + clamp(rise, 0, 6) / 6;
      if (!best || score > best.score) best = { k, score, kind: 'cold' };
    }
  }
  if (!best) return { state: 'none', kind: null, hoursFromNow: null };
  const h = best.k;
  const state: FrontState = h > 2 ? 'approaching' : h >= -2 ? 'passing' : 'passed';
  return { state, kind: best.kind, hoursFromNow: h };
}

/** Rough effect on movement: ahead of and just behind a cold front, deer are said to move more. Kept small. */
function movementFactor(a: { pressure: PressureTrend; front: Front; moon: Moon }, isNight: boolean): number {
  let f = 1;
  const p = a.pressure.change3h;
  if (p != null && p <= -1) f *= p <= -3 ? 1.15 : 1.08;
  if (a.front.state === 'approaching' && (a.front.hoursFromNow ?? 99) <= 12) f *= 1.08;
  if (a.front.state === 'passed' && (a.front.hoursFromNow ?? 0) >= -24) f *= 1.06;
  // Bright nights: a slight tilt toward night feeding, away from the daylight hunter's window.
  if (a.moon.illumination > 0.8) f *= isNight ? 1.05 : 0.97;
  return f;
}

export function atmosphereAt(forecast: Forecast, date: Date, opts: { isNight?: boolean } = {}): Atmosphere {
  const w = weatherAt(forecast, date);
  const pressure = pressureTrend(forecast, date);
  const front = frontPassage(forecast, date);
  const moon = moonPhase(date);
  const dewPointF = w.dewPointF ?? null;
  const spreadF = dewPointF == null ? null : Math.max(0, w.tempF - dewPointF);
  const fog = spreadF != null && spreadF < 3 && w.windMph < 5;
  const cloudPct = w.skyCoverPct ?? null;
  const factor = movementFactor({ pressure, front, moon }, !!opts.isNight);

  const parts: string[] = [];
  if (pressure.word) {
    const mb = pressure.change3h == null ? '' : ` (${pressure.change3h > 0 ? '+' : ''}${pressure.change3h.toFixed(1)} hPa in 3 h)`;
    parts.push(`Barometer ${pressure.word}${mb}.`);
  }
  if (front.state === 'approaching') parts.push(`A cold front looks to be about ${front.hoursFromNow} hours out.`);
  else if (front.state === 'passing') parts.push('A cold front is passing about now.');
  else if (front.state === 'passed') parts.push(`A cold front went through about ${-(front.hoursFromNow ?? 0)} hours ago.`);
  if (dewPointF != null) {
    parts.push(
      fog
        ? `Dew point ${Math.round(dewPointF)}°F is on top of the air temperature: fog and dew likely, scent hangs low.`
        : `Dew point ${Math.round(dewPointF)}°F${spreadF != null && spreadF < 6 ? ', damp air' : spreadF != null && spreadF > 25 ? ', dry air' : ''}.`,
    );
  }
  if (cloudPct != null) parts.push(`Sky ${cloudPct < 15 ? 'clear' : cloudPct < 45 ? 'mostly clear' : cloudPct < 80 ? 'partly to mostly cloudy' : 'overcast'} (${Math.round(cloudPct)}%).`);
  parts.push(`Moon: ${moon.name}, ${Math.round(moon.illumination * 100)}% lit.`);

  return { pressure, front, dewPointF, spreadF, fog, cloudPct, moon, movementFactor: factor, line: parts.join(' ') };
}

/** 0 dry air, 1 muggy. Humid air slows both daytime heating and nighttime cooling a little. */
export const mugginess = (dewPointF: number | undefined) => (dewPointF == null ? 0 : smoothstep(25, 65, dewPointF));
