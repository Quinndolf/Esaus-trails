import { bearingVector, clamp, vectorBearing } from './geo';
import type { Forecast, WeatherHour } from './types';

export interface WeatherAt extends WeatherHour {
  /** True when `date` is outside the forecast and the nearest hour was used. */
  extrapolated: boolean;
  /** 0-1: how much of this reading came from a live observation instead of the forecast. */
  observedWeight: number;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function lerpOpt(a: number | undefined, b: number | undefined, t: number): number | undefined {
  if (a == null) return b;
  if (b == null) return a;
  return lerp(a, b, t);
}

/** Blend two winds as vectors so 350 and 10 average to 0, not 180. Speed is blended separately. */
function blendWind(a: WeatherHour, b: WeatherHour, t: number): { windFrom: number; windMph: number } {
  const [ae, an] = bearingVector(a.windFrom, Math.max(a.windMph, 0.1));
  const [be, bn] = bearingVector(b.windFrom, Math.max(b.windMph, 0.1));
  return { windFrom: vectorBearing(lerp(ae, be, t), lerp(an, bn, t)), windMph: lerp(a.windMph, b.windMph, t) };
}

export function blendHours(a: WeatherHour, b: WeatherHour, t: number, at: string): WeatherHour {
  return {
    at,
    tempF: lerp(a.tempF, b.tempF, t),
    ...blendWind(a, b, t),
    gustMph: lerpOpt(a.gustMph, b.gustMph, t),
    skyCoverPct: lerpOpt(a.skyCoverPct, b.skyCoverPct, t),
    humidityPct: lerpOpt(a.humidityPct, b.humidityPct, t),
    pressureHpa: lerpOpt(a.pressureHpa, b.pressureHpa, t),
    dewPointF: lerpOpt(a.dewPointF, b.dewPointF, t),
  };
}

/** How long a live observation keeps pulling the forecast toward it. */
const OBS_FADE_H = 3;

/**
 * Weather at any moment, for the hour slider. Interpolates between forecast hours,
 * then leans on the latest station observation near "now" (the forecast can be an
 * hour or two behind a front; the station isn't).
 */
export function weatherAt(forecast: Forecast, date: Date): WeatherAt {
  const hours = forecast.hours;
  if (!hours.length) throw new Error('Forecast has no hours');
  const t = date.getTime();
  const at = date.toISOString();
  let base: WeatherHour;
  let extrapolated = false;
  const first = hours[0];
  const last = hours[hours.length - 1];
  if (t <= Date.parse(first.at)) {
    base = { ...first, at };
    extrapolated = t < Date.parse(first.at) - 30 * 60e3;
  } else if (t >= Date.parse(last.at)) {
    base = { ...last, at };
    extrapolated = t > Date.parse(last.at) + 90 * 60e3;
  } else {
    let k = 0;
    while (k < hours.length - 2 && Date.parse(hours[k + 1].at) <= t) k++;
    const a = hours[k];
    const b = hours[k + 1];
    const ta = Date.parse(a.at);
    const tb = Date.parse(b.at);
    base = blendHours(a, b, tb > ta ? (t - ta) / (tb - ta) : 0, at);
  }

  let observedWeight = 0;
  const obs = forecast.observed;
  if (obs) {
    const dh = Math.abs(t - Date.parse(obs.at)) / 3600e3;
    observedWeight = clamp(1 - dh / OBS_FADE_H, 0, 1) * 0.85;
    // Station and model pressures sit on different baselines, so only the forecast's pressure is used.
    if (observedWeight > 0) base = blendHours(base, { ...obs, pressureHpa: undefined }, observedWeight, at);
  }
  return { ...base, extrapolated, observedWeight };
}

/** Hour stamps for the slider: every forecast hour from `from` (default: the first) for `count` hours. */
export function sliderHours(forecast: Forecast, from?: Date, count = 24): Date[] {
  const start = from ? from.getTime() : Date.parse(forecast.hours[0]?.at ?? new Date().toISOString());
  const startHour = Math.floor(start / 3600e3) * 3600e3;
  return Array.from({ length: count }, (_, k) => new Date(startHour + k * 3600e3));
}
