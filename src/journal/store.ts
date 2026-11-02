import { create } from "zustand";
import type { SpeciesId } from "../esau/types";
import type { Weapon } from "../model/sitSpots";
import type { LngLat } from "../map/geo";

/** One finished hunt. Lives in this phone's localStorage only; nothing here is ever uploaded. */
export interface JournalEntry {
  id: string;
  trackId: string | null;
  date: string;
  species: SpeciesId | null;
  weapon: Weapon | null;
  snagged: "yes" | "no" | null;
  what?: string;
  /** Wind the hunter had when they finished (degrees it blows from), if Esau had weather. */
  windFromDeg: number | null;
  /** The hunter's own bed and trail marks at that time, for the scent check. */
  beds: LngLat[];
  trails: LngLat[];
}

const KEY = "esau-journal";
const read = (): JournalEntry[] => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(v)) return [];
    return v
      .filter((e): e is Record<string, unknown> => !!e && typeof e === "object" && typeof (e as { id?: unknown }).id === "string")
      .map((e) => ({ ...e, beds: Array.isArray(e.beds) ? e.beds : [], trails: Array.isArray(e.trails) ? e.trails : [], windFromDeg: typeof e.windFromDeg === "number" ? e.windFromDeg : null }) as unknown as JournalEntry);
  } catch {
    return [];
  }
};
const write = (entries: JournalEntry[]) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    /* storage full or blocked: keep working in memory */
  }
};

interface JournalState {
  entries: JournalEntry[];
  load(): void;
  add(entry: JournalEntry): void;
}

export const useJournal = create<JournalState>((set, get) => ({
  entries: read(),
  load: () => set({ entries: read() }),
  add: (entry) => {
    const entries = [entry, ...get().entries];
    write(entries);
    set({ entries });
  },
}));
