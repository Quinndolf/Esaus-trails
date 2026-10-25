import type { SpeciesId } from "../types";
import type { SpeciesBrain } from "./types";
import { whitetail } from "./whitetail";

export type { SpeciesBrain, SeasonPhase, SpotScores } from "./types";
export { whitetail } from "./whitetail";

/** Species the app lists, in picker order. Only `ready` ones can be asked about yet. */
export const SPECIES: { id: SpeciesId; name: string; ready: boolean }[] = [
  { id: "whitetail", name: "Whitetail deer", ready: true },
  { id: "elk", name: "Elk", ready: false },
  { id: "mule_deer", name: "Mule deer", ready: false },
  { id: "black_bear", name: "Black bear", ready: false },
  { id: "turkey", name: "Wild turkey", ready: false },
  { id: "hog", name: "Wild hog", ready: false },
];

const BRAINS: Partial<Record<SpeciesId, SpeciesBrain>> = { whitetail };

export function speciesBrain(id: SpeciesId): SpeciesBrain | null {
  return BRAINS[id] ?? null;
}
