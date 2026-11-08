import { bearingBetween, cardinal, cellAt, insideBounds, yardsBetween, type Bounds, type LngLat } from "../model/geo";
import type { MovementHour } from "../model/movement";
import type { WindField } from "../model/wind";
import { walkRoute, type WalkRoute } from "../model/walkRoute";
import { sitVerdict, topSitSpots, type Setup, type SitSpot, type SitSpotInput, type SitVerdict, type Weapon } from "../model/sitSpots";
import { squirrelSitSpots } from "../model/squirrelSpots";
import { turkeySitSpots } from "../model/turkeySpots";
import type { ElevationGrid } from "../model/types";
import { legalToday } from "../rules/kentucky";
import type { Legal } from "../rules/types";
import { advisories, type Advisory } from "./advisory";
import type { SitSpotQuery, SpeciesId, VerdictQuery } from "./types";

/** Animals the movement model's trails and beds describe. Squirrel and turkey have their own models; others get no sit spots yet. */
const TRAIL_MODEL_SPECIES: SpeciesId[] = ["whitetail", "mule_deer"];

export interface Analysis {
  spots: SitSpot[];
  unsure: boolean;
  advisories: Advisory[];
  legal: Legal;
  /** Stay or move, for the spot the hunter chose (or stands on). Deer only for now. */
  verdict?: SitVerdict & { at: LngLat; of: "sit" | "hunter" };
  /** A walk in from the hunter (or their chosen spot) to the stand Esau suggests, keeping scent off the deer. */
  route?: WalkRoute & { from: LngLat; to: LngLat };
}

export interface AnalyzeInput {
  /** Pass the ground grid (with `cover`, and `forestType` when known) so squirrels can be read. */
  grid: ElevationGrid & { cover?: ArrayLike<number>; forestType?: ArrayLike<number> };
  movement: Pick<MovementHour, "trails" | "beds">;
  wind: WindField;
  species: SpeciesId;
  weapon: Weapon | null;
  /** Ground (default), tree stand or saddle. */
  setup?: Setup;
  at: Date;
  timeZone?: string;
  /** The hunter's chosen sit spot, if any. Used only for the wrong-wind banner. */
  sit: LngLat | null;
  hunter: LngLat | null;
  /** The map on screen. Esau reads the whole grid (and around it) but only picks sit spots in here. */
  view?: Bounds | null;
  /** The wind for the next few hours, soonest first, to warn before it turns onto the trail. */
  windLater?: { hoursAhead: number; wind: WindField }[];
  /** This hour's scent drift (wind and thermals) and the ground's steepness, for the suggested walk in. */
  scent?: { driftBearing: ArrayLike<number>; spreadDeg: ArrayLike<number> };
  slopeDeg?: ArrayLike<number>;
}

export type { Bounds };

/**
 * Analyze the area for one hour: the ranked sit spots, the legal read, and the big banners.
 * Pure. Reads only land, wind, weather and the hunter's position, never their marks.
 */
export function analyzeHour(i: AnalyzeInput): Analysis {
  const legal = legalToday({ species: i.species, weapon: i.weapon, at: i.at, timeZone: i.timeZone });
  const canRank = i.weapon != null && TRAIL_MODEL_SPECIES.includes(i.species);
  const squirrel =
    i.weapon != null && i.species === "squirrel" && i.grid.cover
      ? squirrelSitSpots({ grid: i.grid, cover: i.grid.cover, forestType: i.grid.forestType, at: i.at, weapon: i.weapon, within: i.view ?? undefined })
      : null;
  const turkey =
    i.weapon != null && i.species === "turkey" && i.grid.cover
      ? turkeySitSpots({ grid: i.grid, cover: i.grid.cover, forestType: i.grid.forestType, at: i.at, weapon: i.weapon, within: i.view ?? undefined })
      : null;
  const ranked = squirrel
    ? squirrel
    : turkey
    ? turkey
    : canRank
    ? topSitSpots(deerInput(i))
    : { spots: [], unsure: true };
  // Judge the hunter's chosen spot, else where they stand when that is on screen.
  const judged: { at: LngLat; of: "sit" | "hunter" } | null = i.sit
    ? { at: i.sit, of: "sit" }
    : i.hunter && i.view && insideBounds(i.view, i.hunter)
      ? { at: i.hunter, of: "hunter" }
      : null;
  const v = canRank && judged ? sitVerdict(deerInput(i), judged.at) : null;

  const route = canRank && i.scent ? suggestRoute(i, ranked.spots, v) : null;

  const sitCell = i.sit ? cellAt(i.grid, i.sit) : null;
  const windAtSit = (w: WindField) => (sitCell != null ? { mph: w.mph[sitCell] ?? 0, fromDeg: w.fromDeg[sitCell] ?? 0 } : { mph: 0, fromDeg: 0 });
  const windHere = windAtSit(i.wind);
  return {
    spots: ranked.spots,
    unsure: ranked.unsure,
    legal,
    ...(v && judged ? { verdict: calmed({ ...v, ...judged }, windAtSit(i.wind).mph) } : {}),
    ...(route ? { route } : {}),
    advisories: advisories({
      legal,
      wind: windHere,
      sit: i.sit ? { lngLat: i.sit } : null,
      later: i.windLater?.map((l) => ({ hoursAhead: l.hoursAhead, wind: windAtSit(l.wind) })),
      targets: [...i.movement.trails.flatMap((t) => t.coordinates.map((lngLat) => ({ lngLat }))), ...i.movement.beds.map((b) => ({ lngLat: b.lngLat }))],
    }),
  };
}

/** In air this still, scent pools rather than blows: don't blame the wind on the card. */
const CALM_MPH = 2;
function calmed<V extends SitVerdict>(v: V, mph: number): V {
  if (v.why !== "scent_on_trail" || mph >= CALM_MPH) return v;
  const { why: _drop, ...rest } = v;
  return rest as V;
}

/** Closer than this, the stand is where you are: no route. */
const ROUTE_MIN_YD = 30;

/**
 * Where to walk: to the better spot when the call is move, to your own spot when it is stay, else to Esau's top
 * pick. From where you stand when the GPS is on the ground read, else from the spot you tapped.
 */
function suggestRoute(i: AnalyzeInput, spots: SitSpot[], v: SitVerdict | null) {
  const to = v ? (v.stay ? i.sit : (v.better[0] ?? v.offScreen)?.lngLat) : spots[0]?.lngLat;
  const from = i.hunter && cellAt(i.grid, i.hunter) != null ? i.hunter : i.sit;
  if (!to || !from || yardsBetween(from, to) < ROUTE_MIN_YD) return null;
  const r = walkRoute({ grid: i.grid, scent: i.scent!, slopeDeg: i.slopeDeg, trails: i.movement.trails, beds: i.movement.beds, from, to });
  return r ? { ...r, from, to } : null;
}

function deerInput(i: AnalyzeInput): SitSpotInput {
  return {
    grid: i.grid,
    trails: i.movement.trails,
    beds: i.movement.beds,
    windFromDeg: (cell) => i.wind.fromDeg[cell] ?? 0,
    weapon: i.weapon!,
    setup: i.setup,
    hunter: i.hunter ?? undefined,
    within: i.view ?? undefined,
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

export const toVerdictQuery = (v: NonNullable<Analysis["verdict"]>): VerdictQuery => ({
  pct: v.pct,
  stay: v.stay,
  of: v.of,
  betterRanks: v.better.map((b) => b.rank),
  rangeYd: v.rangeYd,
  ...(v.why ? { why: v.why } : {}),
  ...(v.trailYd != null ? { trailYd: v.trailYd } : {}),
  ...(v.offScreen
    ? { offScreen: { yards: Math.round(yardsBetween(v.at, v.offScreen.lngLat)), compass: cardinal(bearingBetween(v.at, v.offScreen.lngLat)) } }
    : {}),
});
