import type { SpeciesId } from "../types";
import type { SpeciesBrain } from "./types";
import { blackBear } from "./blackBear";
import { elk } from "./elk";
import { ginseng } from "./ginseng";
import { hog } from "./hog";
import { muleDeer } from "./muleDeer";
import { squirrel } from "./squirrel";
import { turkey } from "./turkey";
import { whitetail } from "./whitetail";

export type { SpeciesBrain, SeasonPhase, SpotScores } from "./types";
export { whitetail } from "./whitetail";
export { elk } from "./elk";
export { muleDeer } from "./muleDeer";
export { blackBear } from "./blackBear";
export { turkey } from "./turkey";
export { hog } from "./hog";
export { squirrel } from "./squirrel";
export { ginseng } from "./ginseng";

/** Species the app lists, in picker order. Only `ready` ones can be asked about yet. */
export const SPECIES: { id: SpeciesId; name: string; ready: boolean }[] = [
  { id: "whitetail", name: "Whitetail deer", ready: true },
  { id: "elk", name: "Elk", ready: true },
  { id: "mule_deer", name: "Mule deer", ready: true },
  { id: "black_bear", name: "Black bear", ready: true },
  { id: "turkey", name: "Wild turkey", ready: true },
  { id: "hog", name: "Wild hog", ready: true },
  { id: "squirrel", name: "Squirrel", ready: true },
  { id: "ginseng", name: "Ginseng", ready: true },
];

const BRAINS: Partial<Record<SpeciesId, SpeciesBrain>> = { whitetail, elk, mule_deer: muleDeer, black_bear: blackBear, turkey, hog, squirrel, ginseng };

export function speciesBrain(id: SpeciesId): SpeciesBrain | null {
  return BRAINS[id] ?? null;
}

/** Deer sign (rubs, scrapes) means nothing to any other animal, so only deer hunters are offered it. */
export const DEER_ONLY_SIGN: readonly string[] = ["rub", "scrape"];
export const isDeer = (id: SpeciesId | null) => id === "whitetail" || id === "mule_deer";
export const signFits = (name: string, id: SpeciesId | null) => !DEER_ONLY_SIGN.includes(name) || isDeer(id);
