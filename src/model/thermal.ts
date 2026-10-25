import { clamp, DEG, normalizeBearing, smoothstep } from './geo';
import { mugginess } from './atmosphere';
import { hoursSince } from './sun';
import type { Terrain } from './terrain';
import { ThermalState, type SunPosition, type SunTimes, type WeatherHour } from './types';

/**
 * Thermals: air sliding along the ground because the ground is warmer or colder
 * than the air over it.
 *
 * The prototype had a four-way switch per cell (sunlit slope rises, shaded slope
 * sinks, draws pool, 12 mph kills it all). This keeps the same four states and
 * codes, but drives them from a continuous heating-minus-cooling balance, so:
 *
 * - The morning flip lags sunrise. Cold air keeps draining for an hour or more
 *   after first light and turns on sun-facing slopes first, shaded hollows last.
 * - The evening flip starts before sunset on faces the sun has left.
 * - Clouds weaken both directions. An overcast day barely rises; an overcast
 *   night barely drains. Clear, calm nights drain hardest.
 * - Wind washes thermals out gradually from about 4 to 13 mph (gusts count),
 *   instead of all at once at 12.
 * - Heavy canopy shades the forest floor and slows daytime heating.
 * - Each cell gets a strength, a ground speed and a flow bearing, so the scent
 *   model can add it to the wind as a vector.
 */

export type DayPhase = 'night' | 'morning' | 'day' | 'evening';

export interface ThermalContext {
  date: Date;
  sun: SunPosition;
  sunTimes: SunTimes;
  weather: WeatherHour;
}

export interface ThermalField {
  phase: DayPhase;
  /** 0-1: how much the wind lets thermals work this hour (1 = calm). */
  thermalWindow: number;
  state: Uint8Array;
  /** 0-1 */
  strength: Float32Array;
  /** Direction air moves along the ground, compass degrees. NaN when it lifts straight up or sits still. */
  flowBearing: Float32Array;
  /** Along-ground speed in mph (thermal flows run about 1-4 mph). */
  speedMph: Float32Array;
}

/** Below this the air is called Settled. */
export const THERMAL_MIN = 0.12;

export function dayPhase({ date, sun, sunTimes }: Pick<ThermalContext, 'date' | 'sun' | 'sunTimes'>): DayPhase {
  const sinceRise = hoursSince(date, sunTimes.sunrise);
  const toSet = -hoursSince(date, sunTimes.sunset);
  if (sun.altitude < -0.833) return 'night';
  if (sinceRise >= 0 && sinceRise < 2) return 'morning';
  if (toSet >= 0 && toSet < 1.75) return 'evening';
  return 'day';
}

/** Effective wind for mixing: sustained plus a share of the gusts. */
export const mixingWind = (w: WeatherHour) => w.windMph + 0.3 * Math.max(0, (w.gustMph ?? w.windMph) - w.windMph);

/** 1 when calm enough for thermals to run, 0 once wind has mixed them out. */
export const thermalWindow = (w: WeatherHour) => smoothstep(13, 4, mixingWind(w));

export function computeThermals(t: Terrain, ctx: ThermalContext): ThermalField {
  const n = t.slopeDeg.length;
  const { sun, sunTimes, weather, date } = ctx;
  const sky = clamp(weather.skyCoverPct ?? 25, 0, 100) / 100;
  // Humid air (high dew point) takes the edge off both daytime heating and night cooling.
  const muggy = mugginess(weather.dewPointF);
  const heatClear = (1 - 0.75 * sky) * (1 - 0.1 * muggy);
  const coolClear = (1 - 0.8 * sky) * (1 - 0.2 * muggy);
  // Air sitting on its dew point with no wind: fog, and cold air settles harder into the lows.
  const fogged = weather.dewPointF != null && weather.tempF - weather.dewPointF < 3 && weather.windMph < 5;
  const window = thermalWindow(weather);

  const sinceRise = hoursSince(date, sunTimes.sunrise);
  const toSet = -hoursSince(date, sunTimes.sunset);
  const sunUp = sun.altitude > -0.833;
  // Overnight cold air takes time to burn off: 0 at sunrise, full by ~1.75 h after.
  const warm = !sunUp ? 0 : Number.isFinite(sinceRise) ? smoothstep(0.25, 1.75, sinceRise) : 1;
  // Cooling ramps up through the last ~2 hours of daylight.
  const evening = sunUp && Number.isFinite(toSet) ? smoothstep(1.75, -0.25, toSet) : 0;

  const alt = Math.max(0, sun.altitude) * DEG;
  const az = sun.azimuth * DEG;

  const state = new Uint8Array(n);
  const strength = new Float32Array(n);
  const flowBearing = new Float32Array(n).fill(Number.NaN);
  const speedMph = new Float32Array(n);

  for (let i = 0; i < n; i++) {
    const slope = t.slopeDeg[i];
    const aspect = t.aspectDeg[i];
    const s = slope * DEG;
    const hasAspect = Number.isFinite(aspect);
    // Fraction of full sun hitting this surface (cosine of the incidence angle).
    const incidence = sunUp
      ? Math.sin(alt) * Math.cos(s) + (hasAspect ? Math.cos(alt) * Math.sin(s) * Math.cos(az - aspect * DEG) : 0)
      : 0;
    const lit = Math.max(0, incidence);

    const shade = 1 - 0.4 * (t.canopyPct[i] / 100);
    const rise = lit * heatClear * shade * warm * 1.25;

    const night = sunUp ? 0 : 1;
    const leftover = sunUp ? (1 - warm) * 0.9 : 0;
    // Faces the sun only grazes lose heat to the open sky faster than it comes in.
    const shaded = sunUp ? 0.55 * smoothstep(0.25, 0, incidence) : 0;
    const dusk = evening * (1 - Math.min(1, lit / 0.45));
    const cool = coolClear * Math.max(night, leftover, shaded, dusk);

    const net = rise - cool;
    const lowGround = t.drainage[i] > 0.55 || t.position[i] < -0.3;
    const alongSlope = smoothstep(1.5, 8, slope);
    let st = ThermalState.Settled;
    let k = 0;
    let bearing = Number.NaN;
    let speed = 0;

    if (net > 0) {
      k = clamp(net, 0, 1) * window;
      st = ThermalState.Rising;
      if (hasAspect && slope >= 3) {
        bearing = normalizeBearing(aspect + 180);
        speed = (0.6 + 2.6 * k) * Math.max(0.4, alongSlope);
      }
      // Flat ground in the sun: convection lifts scent straight up, no ground flow.
    } else if (net < 0) {
      if (lowGround && slope < 10) {
        k = clamp(-net * (fogged ? 1.2 : 1), 0, 1) * window;
        st = ThermalState.Pooling;
        if (hasAspect) bearing = aspect;
        speed = 0.3 + 0.8 * k;
      } else {
        k = clamp(-net, 0, 1) * window * alongSlope;
        st = ThermalState.Sinking;
        if (hasAspect) bearing = aspect;
        speed = (0.6 + 3.2 * k) * Math.sqrt(Math.min(slope, 25) / 25);
      }
    }
    if (k < THERMAL_MIN) {
      st = ThermalState.Settled;
      k = 0;
      bearing = Number.NaN;
      speed = 0;
    }
    state[i] = st;
    strength[i] = k;
    flowBearing[i] = bearing;
    speedMph[i] = speed;
  }
  return { phase: dayPhase(ctx), thermalWindow: window, state, strength, flowBearing, speedMph };
}
