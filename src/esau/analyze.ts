import { cellAt, type LngLat } from "../model/geo";
import type { MovementHour } from "../model/movement";
import type { WindField } from "../model/wind";
import { topSitSpots, type SitSpot, type Weapon } from "../model/sitSpots";
import { squirrelSitSpots } from "../model/squirrelSpots";
import { turkeySitSpots } from "../model/turkeySpots";
import type { ElevationGrid } from "../model/types";
import { legalToday } from "../rules/kentucky";
import type { Legal } from "../rules/types";
import { advisories, type Advisory } from "./advisory";
import type { SitSpotQuery, SpeciesId } from "./types";

/** Animals the movement model's trails and beds describe. Squirrel and turkey have their own models; others get no sit spots yet. */
const TRAIL_MODEL_SPECIES: SpeciesId[] = ["whitetail", "mule_deer"];

export interface Analysis {
  spots: SitSpot[];
  unsure: boolean;
  advisories: Advisory[];
  legal: Legal;
}

export interface AnalyzeInput {
  /** Pass the ground grid (with `cover`, and `forestType` when known) so squirrels can be read. */
  grid: ElevationGrid & { cover?: ArrayLike<number>; forestType?: ArrayLike<number> };
  movement: Pick<MovementHour, "trails" | "beds">;
  wind: WindField;
  species: SpeciesId;
  weapon: Weapon | null;
  at: Date;
  timeZone?: string;
  /** The hunter's chosen sit spot, if any. Used only for the wrong-wind banner. */
  sit: LngLat | null;
  hunter: LngLat | null;
  /** The map on screen. Esau reads the whole grid (and around it) but only picks sit spots in here. */
  view?: Bounds | null;
}

export interface Bounds {
  west: number;
  east: number;
  south: number;
  north: number;
}

/** Ask the rankers for more than three, so there are still three after the screen filter. */
const POOL = 12;

const inside = (b: Bounds, [lng, lat]: LngLat) => lng >= b.west && lng <= b.east && lat >= b.south && lat <= b.north;

/** Keep the picks on screen, renumbered from 1 and scored against the best one left. */
function onScreen(r: { spots: SitSpot[]; unsure: boolean }, view: Bounds | null | undefined, keep = 3) {
  if (!view) return { spots: r.spots.slice(0, keep), unsure: r.unsure };
  const kept = r.spots.filter((s) => inside(view, s.lngLat)).slice(0, keep);
  if (!kept.length) return { spots: [], unsure: true };
  const top = kept[0]!.score || 1;
  return { spots: kept.map((s, k) => ({ ...s, rank: k + 1, score: s.score / top })), unsure: r.unsure };
}

/**
 * Analyze the area for one hour: the ranked sit spots, the legal read, and the big banners.
 * Pure. Reads only land, wind, weather and the hunter's position, never their marks.
 */
export function analyzeHour(i: AnalyzeInput): Analysis {
  const legal = legalToday({ species: i.species, weapon: i.weapon, at: i.at, timeZone: i.timeZone });
  const canRank = i.weapon != null && TRAIL_MODEL_SPECIES.includes(i.species);
  const squirrel =
    i.weapon != null && i.species === "squirrel" && i.grid.cover
      ? squirrelSitSpots({ grid: i.grid, cover: i.grid.cover, forestType: i.grid.forestType, at: i.at, weapon: i.weapon, max: POOL })
      : null;
  const turkey =
    i.weapon != null && i.species === "turkey" && i.grid.cover
      ? turkeySitSpots({ grid: i.grid, cover: i.grid.cover, forestType: i.grid.forestType, at: i.at, weapon: i.weapon, max: POOL })
      : null;
  const pooled = squirrel
    ? squirrel
    : turkey
    ? turkey
    : canRank
    ? topSitSpots({
        grid: i.grid,
        trails: i.movement.trails,
        beds: i.movement.beds,
        windFromDeg: (cell) => i.wind.fromDeg[cell] ?? 0,
        weapon: i.weapon!,
        hunter: i.hunter ?? undefined,
        max: POOL,
      })
    : { spots: [], unsure: true };
  const ranked = onScreen(pooled, i.view);

  let windHere = { mph: 0, fromDeg: 0 };
  if (i.sit) {
    const cell = cellAt(i.grid, i.sit);
    if (cell != null) windHere = { mph: i.wind.mph[cell] ?? 0, fromDeg: i.wind.fromDeg[cell] ?? 0 };
  }
  return {
    spots: ranked.spots,
    unsure: ranked.unsure,
    legal,
    advisories: advisories({
      legal,
      wind: windHere,
      sit: i.sit ? { lngLat: i.sit } : null,
      targets: [...i.movement.trails.flatMap((t) => t.coordinates.map((lngLat) => ({ lngLat }))), ...i.movement.beds.map((b) => ({ lngLat: b.lngLat }))],
    }),
  };
}

export const toSitSpotQuery = (s: SitSpot): SitSpotQuery => ({
  rank: s.rank,
  lat: s.lngLat[1],
  lng: s.lngLat[0],
  watchBearingDeg: s.watchBearingDeg,
  yardsToTrail: s.yardsToTrail,
  reason: s.reason,
  kind: s.kind,
});
