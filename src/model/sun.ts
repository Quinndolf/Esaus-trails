import { DEG, normalizeBearing } from './geo';
import type { SunPosition, SunTimes } from './types';

/**
 * Low-precision solar position (good to a fraction of a degree, 1950-2050).
 * Same ephemeris the prototype used, kept so the two agree.
 */
export function sunPosition(date: Date, lat: number, lng: number): SunPosition {
  const n = date.getTime() / 864e5 + 2440587.5 - 2451545; // days since J2000
  const L = (280.46 + 0.9856474 * n) % 360;
  const g = ((((357.528 + 0.9856003 * n) % 360) + 360) % 360) * DEG;
  let lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) % 360;
  if (lambda < 0) lambda += 360;
  const lam = lambda * DEG;
  const eps = (23.439 - 4e-7 * n) * DEG;
  const dec = Math.asin(Math.sin(eps) * Math.sin(lam));
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam));
  const gmst = (((18.697374558 + 24.06570982441908 * n) % 24) + 24) % 24;
  const ha = normalizeBearing(gmst * 15 + lng) * DEG - ra;
  const phi = lat * DEG;
  const alt = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(ha));
  const az = Math.atan2(-Math.sin(ha), Math.tan(dec) * Math.cos(phi) - Math.sin(phi) * Math.cos(ha));
  return { altitude: alt / DEG, azimuth: normalizeBearing(az / DEG) };
}

/** Sun altitude at the moment of official sunrise/sunset (refraction + disc). */
const HORIZON = -0.833;

function crossing(t0: number, t1: number, lat: number, lng: number, rising: boolean): Date | null {
  const f = (t: number) => sunPosition(new Date(t), lat, lng).altitude - HORIZON;
  const step = 10 * 60e3;
  let prev = f(t0);
  for (let t = t0 + step; t <= t1; t += step) {
    const cur = f(t);
    if (rising ? prev < 0 && cur >= 0 : prev >= 0 && cur < 0) {
      let lo = t - step;
      let hi = t;
      for (let k = 0; k < 20; k++) {
        const mid = (lo + hi) / 2;
        const v = f(mid);
        if (rising ? v < 0 : v >= 0) lo = mid;
        else hi = mid;
      }
      return new Date((lo + hi) / 2);
    }
    prev = cur;
  }
  return null;
}

/**
 * Sunrise, sunset and solar noon for the local solar day that contains `date`.
 * Returns null times for polar day/night.
 */
export function sunTimes(date: Date, lat: number, lng: number): SunTimes {
  const lngMs = (lng / 15) * 3600e3;
  const local = new Date(date.getTime() + lngMs);
  const noon = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), 12) - lngMs;
  return {
    sunrise: crossing(noon - 12 * 3600e3, noon, lat, lng, true),
    sunset: crossing(noon, noon + 12 * 3600e3, lat, lng, false),
    solarNoon: new Date(noon),
  };
}

/** Signed hours from `date` to `ref` (positive when `ref` is earlier, i.e. "hours since"). */
export const hoursSince = (date: Date, ref: Date | null) =>
  ref ? (date.getTime() - ref.getTime()) / 3600e3 : Number.NaN;
