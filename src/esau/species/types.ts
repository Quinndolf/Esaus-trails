import type { ConditionsReading, SpeciesId, SpotReading } from "../types";

export interface SeasonPhase {
  id: string;
  notes: string;
  /** False when the rut date is a guess (the Deep South, or no state data). */
  rutPeakConfident: boolean;
  daysFromRutPeak?: number;
}

export interface SpotScores {
  bedding: number;
  feeding: number;
  travel: number;
}

/** Everything Esau knows about one animal. One file per species under src/species/. */
export interface SpeciesBrain {
  id: SpeciesId;
  name: string;
  /** False until the species has its own knowledge base. Esau will not blur species. */
  ready: boolean;
  /** Stable text for the cached system prompt. */
  knowledge: string;
  /** Citable works, keyed as the knowledge text references them. */
  sources: Record<string, string>;
  /** A plant, not an animal: no scent, wind or thermal advice. */
  plant?: boolean;
  /** Replaces Esau's hunting persona (ginseng mode). Must keep the same reply format. */
  persona?: string;
  /** Replaces the ROUGH SCORES line of the field report with species-specific lines. */
  report?(spot: SpotReading, cond: ConditionsReading, phase: SeasonPhase, at: Date): string[];
  /** Whether the animal hunts by nose. Turkeys don't; everything with hair does. */
  nose: boolean;
  /** How the offline read names what a spot is for, in this animal's terms. */
  words: { bedding: string; feeding: string; travel: string };
  phase(at: Date, lat: number, rutPeak?: Date): SeasonPhase;
  scores(spot: SpotReading, cond: ConditionsReading, phase: SeasonPhase): SpotScores;
}
