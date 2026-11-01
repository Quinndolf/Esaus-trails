/**
 * Shared shapes for Esau's brain.
 *
 * `GroundGrid` is the payload the prototype's "Analyze this view" call returned
 * (32x32 cells over the visible map), kept field-for-field so the map phase can
 * hand it straight over. Cells are row-major, row 0 is the NORTH edge, col 0 the WEST edge.
 */

export interface WeatherHour {
  /** ISO timestamp for the start of the hour. */
  at: string;
  tempF: number;
  windMph: number;
  /** Degrees the wind blows FROM (meteorological convention, 0 = north). */
  windFrom: number;
  /** Optional extras a richer weather source may add. */
  gustMph?: number;
  skyCover?: number; // 0-100 %
  precipChance?: number; // 0-100 %
  pressureInHg?: number;
  /** Surface pressure, hPa, and dew point, °F: from the weather provider when it has them. */
  pressureHpa?: number;
  dewPointF?: number;
}

export interface GroundGrid {
  west: number;
  south: number;
  east: number;
  north: number;
  cols: number;
  rows: number;
  /** Elevation in meters, length cols*rows. */
  elevationM: number[];
  /** NLCD land cover class codes, length cols*rows. */
  cover: number[];
  /** USDA Cropland Data Layer codes, length cols*rows (0 = none/unknown). */
  crop: number[];
  /** NDVI x 100 from overhead imagery (NAIP), length cols*rows. Absent when the imagery could not be read. */
  greenness?: number[];
  /** USFS forest type group per cell (500 = oak-hickory). Absent until that raster is wired. */
  forestType?: number[];
  weather: { source: string; hours: WeatherHour[] };
  notes?: string[];
}

export type PinKind = "food" | "water" | "bed" | "sign" | "stand" | "photo";

/** A hunter-dropped pin. Food/water/bed pins override what the grid infers. */
export interface Pin {
  id: string;
  kind: PinKind;
  lat: number;
  lng: number;
  name?: string;
  note?: string;
  tags?: string[];
}

export type SpeciesId = "whitetail" | "elk" | "mule_deer" | "black_bear" | "turkey" | "hog" | "squirrel" | "ginseng";

/** Thermal state of a cell, same codes as the prototype. */
export type ThermalState = "settled" | "rising" | "sinking" | "pooling";

export interface LatLng {
  lat: number;
  lng: number;
}

/** What the app sends when the hunter taps a spot (or asks a follow-up). */
export interface SpotQuery {
  species: SpeciesId;
  /** The tapped spot. */
  spot: LatLng;
  /** The hunter's GPS fix, if known. Esau always reasons about where they stand. */
  hunter?: LatLng & { accuracyM?: number; headingDeg?: number };
  grid: GroundGrid;
  /** Index into grid.weather.hours the hour slider points at. Defaults to 0. */
  hourIndex?: number;
  /** Names of map layers covering the spot ("Public access: Daniel Boone NF", "Private: J. Smith"). */
  layersHere?: string[];
  /** IANA zone for talking about clock time. Defaults to the device's zone. */
  timeZone?: string;
  /** The hunter's own words, if they asked something. */
  question?: string;
  /** Prior turns about this same spot, oldest first. */
  history?: { role: "hunter" | "esau"; text: string }[];
}

/** Terrain read for one spot, all in hunter units (feet, yards, degrees). */
export interface SpotReading {
  elevationFt: number;
  slopeDeg: number;
  /** Direction the slope faces, degrees (0 = north-facing). null on flat ground. */
  aspectDeg: number | null;
  aspectName: string | null;
  /** Feet above (+) or below (-) the average ground within ~300 yd. */
  reliefFt: number;
  /** Position on the landform. */
  landform: Landform;
  cover: { code: number; name: string; woody: boolean };
  crop: { code: number; name: string } | null;
  canopy: number; // 0-1 rough estimate from cover class
  nearestFoodYd: number | null;
  nearestFoodWhat: string | null;
  nearestWaterYd: number | null;
  nearestEdgeYd: number | null;
  /** Bearing and yards from the hunter to the spot, when the hunter's GPS is known. */
  fromHunter: { yards: number; bearingDeg: number; compass: string; climbFt: number } | null;
  /** Features worth naming inside ~400 yd. */
  nearby: NearbyFeature[];
}

export type Landform =
  | "ridgetop"
  | "point"
  | "saddle"
  | "upper slope"
  | "bench"
  | "mid slope"
  | "lower slope"
  | "draw"
  | "creek bottom"
  | "flat";

export interface NearbyFeature {
  kind: "saddle" | "bench" | "point" | "draw" | "food" | "water" | "edge" | "pin";
  label: string;
  yards: number;
  bearingDeg: number;
  compass: string;
  lat: number;
  lng: number;
}

export interface ConditionsReading {
  at: string;
  localTime: string;
  tempF: number;
  windMph: number;
  windFrom: number;
  windFromCompass: string;
  /** Where scent carries: the direction the wind blows TOWARD. */
  scentToward: number;
  scentTowardCompass: string;
  gustMph?: number;
  sun: { altitudeDeg: number; azimuthDeg: number; phase: "night" | "dawn" | "morning" | "midday" | "afternoon" | "dusk" };
  thermal: { state: ThermalState; plain: string };
  /** Pressure trend, front, dew point, cloud and moon, as plain sentences. Empty when the model has no data. */
  atmosphere?: string;
  /** The next few hours, so Esau can say "by ten the thermals flip". */
  outlook: { localTime: string; windMph: number; windFromCompass: string; thermal: ThermalState }[];
}

/** One map callout Esau wants drawn. */
export interface EsauMark {
  kind: "bedding" | "feeding" | "travel" | "stand" | "approach" | "avoid";
  lat: number;
  lng: number;
  label: string;
}

/** What comes back to the app. */
export interface EsauReply {
  /** What Esau says, in his voice. */
  say: string;
  /** The fuller lesson. The app shows it only after the hunter taps "Teach me more". */
  more: string;
  /** One line for a map bubble or notification. */
  headline: string;
  confidence: "low" | "fair" | "good";
  /** What this spot most likely is to the animal right now. */
  spotRole:
    | "bedding" | "feeding" | "travel" | "staging" | "security cover" | "open ground" | "unlikely"
    | "good ground" | "fair ground" | "poor ground";
  marks: EsauMark[];
  /** Short list of what would change his read (e.g. "fresh rubs on that bench"). */
  wouldChangeMyMind: string[];
  /** Diagnostics for the app, not for display. */
  meta: { model: string; servedBy: string; inputTokens: number; outputTokens: number; ms: number; offlineWhy?: string };
}
