/**
 * Shared types. Conventions used everywhere in this package:
 *
 * - Bearings are compass degrees, 0 = north, 90 = east, clockwise.
 * - `windFrom` is meteorological: the direction wind blows FROM (a north wind is 0).
 *   Anything named `toward`, `flowBearing` or `driftBearing` is the direction air MOVES.
 * - Slope aspect is the direction a slope FACES, i.e. its downhill direction.
 * - Points are [lng, lat] tuples, the same LngLat as src/map/geo.ts.
 * - Grids are row-major with row 0 on the north edge and column 0 on the west edge,
 *   the same layout the prototype's 32x32 "Analyze this view" grid used.
 */

export interface ElevationGrid {
  west: number;
  south: number;
  east: number;
  north: number;
  cols: number;
  rows: number;
  /** Elevation in meters, length cols*rows. */
  elevationM: ArrayLike<number>;
  /** Optional tree canopy cover 0-100 per cell (NLCD tree canopy). Shading weakens daytime heating. */
  canopyPct?: ArrayLike<number>;
}

/** One hour of weather, already in hunter units. */
export interface WeatherHour {
  /** ISO 8601 timestamp (UTC) for the start of the hour. */
  at: string;
  tempF: number;
  /** Sustained wind, mph. */
  windMph: number;
  /** Wind direction, degrees the wind blows FROM. */
  windFrom: number;
  gustMph?: number;
  /** Cloud cover 0-100. Clear skies make the strongest thermals both ways. */
  skyCoverPct?: number;
  humidityPct?: number;
  /** Surface (station-level) air pressure, hPa. Drives the pressure trend and front detection. */
  pressureHpa?: number;
  /** Dew point, °F. Close to the air temperature means fog, dew and settled air. */
  dewPointF?: number;
}

export interface WeatherObservation extends WeatherHour {
  /** Station id (NWS) or a model label for nowcasts. */
  station: string;
}

export type ForecastSource = 'nws' | 'open-meteo';

export interface Forecast {
  source: ForecastSource;
  lat: number;
  lon: number;
  /** ISO time the forecast was fetched. */
  fetchedAt: string;
  /** IANA zone for the point when the provider gives one. */
  timeZone?: string;
  /** Hourly steps, sorted by time. */
  hours: WeatherHour[];
  /** Latest real observation near the point, used to correct the current hour. */
  observed?: WeatherObservation;
  /** True when this came from cache past its freshness window (no signal in the timber). */
  stale?: boolean;
}

export interface SunPosition {
  /** Degrees above the horizon (negative below). */
  altitude: number;
  /** Compass bearing of the sun. */
  azimuth: number;
}

export interface SunTimes {
  sunrise: Date | null;
  sunset: Date | null;
  solarNoon: Date;
}

/** Same codes the prototype used, so its overlays and copy carry over. */
export enum ThermalState {
  Settled = 0,
  Rising = 1,
  Sinking = 2,
  Pooling = 3,
}
