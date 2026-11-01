import type { SpeciesId } from "../esau/types";
import type { Weapon } from "../model/sitSpots";

export type { Weapon };
export const WEAPONS: Weapon[] = ["bow", "crossbow", "rifle", "muzzleloader", "shotgun", "pellet"];

export interface Legal {
  /** open: in season for this animal and weapon today. closed: out of season, or the weapon isn't allowed. unknown: not in the table; Esau says to check the guide. */
  status: "open" | "closed" | "unknown";
  /** One plain sentence Esau can lean on. */
  note: string;
  seasonLabel?: string;
  /** Where the dates came from, and the day they were checked. */
  source?: string;
  verified?: string;
  /** True when a date in the table is inferred, not read from the guide. */
  unconfirmed?: boolean;
}

export interface LegalQuery {
  species: SpeciesId;
  weapon: Weapon | null;
  at: Date;
  /** Only Monroe County is tuned; anything else is treated as Monroe's rules. */
  county?: string;
}

export interface HarvestSteps {
  steps: string[];
  phones: string[];
  source: string;
  verified: string;
}
