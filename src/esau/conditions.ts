import { compass, norm360, sunPosition, toRad } from "./geo";
import { terrainModel } from "./terrain";
import type { ConditionsReading, GroundGrid, LatLng, ThermalState, WeatherHour } from "./types";

/**
 * Thermal state for one cell at one hour.
 *
 * This is the prototype's rule set, kept as a seam: the wind and thermal thread
 * builds the full model, and anything matching this signature can replace it via
 * `readConditions(..., { thermal })`.
 */
export type ThermalFn = (args: {
  grid: GroundGrid;
  cellIndex: number;
  hour: WeatherHour;
  sunAltitudeDeg: number;
  sunAzimuthDeg: number;
}) => ThermalState;

export const prototypeThermal: ThermalFn = ({ grid, cellIndex, hour, sunAltitudeDeg, sunAzimuthDeg }) => {
  const m = terrainModel(grid);
  const slope = m.slopeDeg[cellIndex]!;
  const aspect = m.aspectDeg[cellIndex]!;
  const draw = m.flow[cellIndex]! > 0.55 || m.tpiLarge[cellIndex]! < -8;
  // Sun incidence on the slope face (1 = square on, <=0 = facing away).
  const s = toRad(slope);
  const z = toRad(90 - sunAltitudeDeg);
  const incidence = Number.isNaN(aspect)
    ? Math.cos(z)
    : Math.cos(z) * Math.cos(s) + Math.sin(z) * Math.sin(s) * Math.cos(toRad(sunAzimuthDeg - aspect));
  const sunlit = sunAltitudeDeg > 6 && incidence > 0.2 && slope > 4;
  const shaded = sunAltitudeDeg > 0 && incidence < 0.05 && slope > 5;

  if (sunAltitudeDeg < -2) return draw ? "pooling" : "sinking";
  if (hour.windMph >= 12) return "settled";
  if (sunlit) return "rising";
  if (draw && sunAltitudeDeg < 18) return "pooling";
  if (shaded) return "sinking";
  return draw ? "pooling" : "settled";
};

const THERMAL_PLAIN: Record<ThermalState, string> = {
  rising: "Sun is on this slope. Scent wants to climb.",
  sinking: "This slope is in shade or the sun is down. Air slides downhill.",
  pooling: "Low ground. Cool air and scent pool and drift down the drainage.",
  settled: "No strong thermal here. The wind is the whole story.",
};

function sunPhase(alt: number, az: number): ConditionsReading["sun"]["phase"] {
  if (alt < -6) return "night";
  if (alt < 8) return az < 180 ? "dawn" : "dusk";
  if (alt < 25) return az < 180 ? "morning" : "afternoon";
  return "midday";
}

export function localTime(iso: string, timeZone?: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function readConditions(
  grid: GroundGrid,
  spot: LatLng,
  hourIndex = 0,
  opts: { timeZone?: string; thermal?: ThermalFn; outlookHours?: number } = {},
): ConditionsReading {
  const hours = grid.weather.hours;
  if (!hours.length) throw new Error("grid has no weather hours");
  const k = Math.min(hours.length - 1, Math.max(0, hourIndex));
  const thermal = opts.thermal ?? prototypeThermal;
  const m = terrainModel(grid);
  const { r, c } = m.geom.cellOf(spot);
  const cellIndex = m.geom.idx(r, c);

  const at = (h: WeatherHour) => {
    const sun = sunPosition(new Date(h.at), spot.lat, spot.lng);
    return {
      sun,
      thermal: thermal({ grid, cellIndex, hour: h, sunAltitudeDeg: sun.altitudeDeg, sunAzimuthDeg: sun.azimuthDeg }),
    };
  };

  const h = hours[k]!;
  const now = at(h);
  const scentToward = norm360(h.windFrom + 180);
  const outlook = hours.slice(k + 1, k + 1 + (opts.outlookHours ?? 6)).map((x) => ({
    localTime: localTime(x.at, opts.timeZone),
    windMph: Math.round(x.windMph),
    windFromCompass: compass(x.windFrom),
    thermal: at(x).thermal,
  }));

  return {
    at: h.at,
    localTime: localTime(h.at, opts.timeZone),
    tempF: Math.round(h.tempF),
    windMph: Math.round(h.windMph),
    windFrom: Math.round(h.windFrom),
    windFromCompass: compass(h.windFrom),
    scentToward: Math.round(scentToward),
    scentTowardCompass: compass(scentToward),
    gustMph: h.gustMph,
    sun: {
      altitudeDeg: Math.round(now.sun.altitudeDeg),
      azimuthDeg: Math.round(now.sun.azimuthDeg),
      phase: sunPhase(now.sun.altitudeDeg, now.sun.azimuthDeg),
    },
    thermal: { state: now.thermal, plain: THERMAL_PLAIN[now.thermal] },
    outlook,
  };
}
