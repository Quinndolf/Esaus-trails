import { create } from 'zustand';
import { buildBrief, type EsauBrief } from '../brief';
import { askEsau, EsauApiError } from '../client';
import { toSitSpotQuery, type Analysis } from '../analyze';
import type { Weapon } from '../../rules/types';
import { offlineRead } from '../offline';
import type { EsauReply, GroundGrid, LatLng, SpeciesId, SpotQuery } from '../types';
import { groundFor } from './ground';

export interface Hunter {
  lat: number;
  lng: number;
  accuracyM?: number;
  headingDeg?: number;
}

export type Status = 'idle' | 'loading-ground' | 'asking' | 'ready' | 'error';

interface Turn {
  role: 'hunter' | 'esau';
  text: string;
}

interface EsauState {
  open: boolean;
  /** What the hunter is after. Null until they choose; Esau reads nothing before then. */
  species: SpeciesId | null;
  /** The picker is open to change the animal (it is always open while `species` is null). */
  choosing: boolean;
  spot: LatLng | null;
  grid: GroundGrid | null;
  hourIndex: number;
  /** The hour Esau's current reply was for, so the panel can offer to re-ask. */
  replyHour: number | null;
  reply: EsauReply | null;
  history: Turn[];
  status: Status;
  error: string | null;
  hunter: Hunter | null;
  /** What the hunter carries. Null until they pick one, which the app asks right after the animal. */
  weapon: Weapon | null;
  /** Where the hunter plans to sit. A tap on the map sets it. Stays on the phone. */
  sit: LatLng | null;
  /** The latest area analysis: sit spots, legal read and banners. */
  analysis: Analysis | null;
  /** Registered by the app glue (src/esau/ui/analyzeArea.ts): works out an analysis for the slider's hour. */
  analyzer: ((sit: LatLng | null) => Analysis | null) | null;

  setWeapon(w: Weapon | null): void;
  setHunter(h: Hunter | null): void;
  setSpecies(s: SpeciesId | null): void;
  setChoosing(open: boolean): void;
  setHour(i: number): void;
  /** The app's hour slider drives this: Esau reads the grid hour nearest `at`. */
  setTime(at: Date): void;
  /** Last time the slider asked for, kept so a newly loaded grid starts on it. */
  time: Date | null;
  tapSpot(spot: LatLng): Promise<void>;
  ask(question?: string): Promise<void>;
  close(): void;
}

const SPECIES_KEY = 'esau-hunt';
const WEAPON_KEY = 'esau-weapon';
const WEAPONS = ['bow', 'crossbow', 'rifle', 'muzzleloader', 'shotgun', 'pellet'];

function savedWeapon(): Weapon | null {
  try {
    const v = localStorage.getItem(WEAPON_KEY);
    return v && WEAPONS.includes(v) ? (v as Weapon) : null;
  } catch {
    return null;
  }
}
const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

function savedSpecies(): SpeciesId | null {
  try {
    const v = localStorage.getItem(SPECIES_KEY);
    if (v === 'whitetail' || v === 'elk' || v === 'mule_deer' || v === 'black_bear' || v === 'turkey' || v === 'hog' || v === 'squirrel' || v === 'ginseng') return v;
  } catch {
    /* ignore */
  }
  return null;
}

export function nearestHour(grid: GroundGrid, at: Date): number {
  let best = 0, bestD = Infinity;
  grid.weather.hours.forEach((h, i) => {
    const d = Math.abs(Date.parse(h.at) - at.getTime());
    if (d < bestD) { bestD = d; best = i; }
  });
  return best;
}

/** Bumped on every new spot so a slow answer for an old tap can't overwrite a new one. */
let ticket = 0;

export const useEsau = create<EsauState>((set, get) => ({
  open: false,
  species: savedSpecies(),
  choosing: false,
  spot: null,
  grid: null,
  hourIndex: 0,
  replyHour: null,
  reply: null,
  history: [],
  status: 'idle',
  error: null,
  hunter: null,
  weapon: savedWeapon(),
  sit: null,
  analysis: null,
  analyzer: null,
  time: null,

  setWeapon(weapon) {
    try {
      if (weapon) localStorage.setItem(WEAPON_KEY, weapon);
      else localStorage.removeItem(WEAPON_KEY);
    } catch {
      /* ignore */
    }
    set({ weapon, reply: null });
    if (weapon && get().spot && get().grid) void get().ask();
  },

  setHunter: (hunter) => set({ hunter }),

  setSpecies(species) {
    try {
      if (species) localStorage.setItem(SPECIES_KEY, species);
      else localStorage.removeItem(SPECIES_KEY);
    } catch {
      /* ignore */
    }
    ticket++;
    set({ species, choosing: false, reply: null, history: [] });
    if (species && get().spot && get().grid) void get().ask();
  },

  setChoosing: (choosing) => set({ choosing }),

  setHour: (hourIndex) => set({ hourIndex }),

  setTime(at) {
    const grid = get().grid;
    set({ time: at, ...(grid ? { hourIndex: nearestHour(grid, at) } : {}) });
  },

  async tapSpot(spot) {
    if (!get().species) return;
    const t = ++ticket;
    // A tap says where you will sit, and Esau reads that spot.
    set({ open: true, spot, sit: spot, reply: null, history: [], status: 'loading-ground', error: null });
    try {
      const grid = await groundFor(spot);
      if (t !== ticket) return;
      const time = get().time;
      set({ grid, hourIndex: time ? nearestHour(grid, time) : 0 });
      await get().ask();
    } catch (err) {
      if (t !== ticket) return;
      set({ status: 'error', error: err instanceof Error ? err.message : "Couldn't read the ground here." });
    }
  },

  async ask(question) {
    const s = get();
    if (!s.spot || !s.grid || !s.species) return;
    const t = ticket;
    const q = question?.trim();
    const an = s.analyzer?.(s.sit ?? s.spot) ?? null;
    if (an) set({ analysis: an });
    const base: SpotQuery = {
      species: s.species,
      weapon: s.weapon ?? undefined,
      ...(an ? { sitSpots: an.spots.map(toSitSpotQuery), sitUnsure: an.unsure } : {}),
      spot: s.spot,
      hunter: s.hunter ?? undefined,
      grid: s.grid,
      hourIndex: s.hourIndex,
      timeZone: TZ,
      question: q || undefined,
      history: s.history.length ? s.history : undefined,
    };
    // A follow-up keeps Esau's earlier words in front of him.
    const history: Turn[] = [...s.history];
    if (s.reply && q) history.push({ role: 'esau', text: s.reply.say });
    if (q) history.push({ role: 'hunter', text: q });
    set({ status: 'asking', error: null });
    try {
      const reply = await askEsau(base);
      if (t !== ticket) return;
      set({ reply, replyHour: s.hourIndex, history, status: 'ready' });
    } catch (err) {
      if (t !== ticket) return;
      const msg = err instanceof EsauApiError || err instanceof Error ? err.message : 'Esau hit a snag.';
      set({ status: 'error', error: msg });
    }
  },

  close() {
    ticket++;
    set({ open: false, spot: null, sit: null, analysis: null, reply: null, history: [], status: 'idle', error: null });
  },
}));

/** The instant rule-based read for the current hour, for scrubbing the slider without spending a call. */
export function quickBrief(s: Pick<EsauState, 'species' | 'spot' | 'grid' | 'hourIndex' | 'hunter' | 'weapon'>): EsauBrief | null {
  if (!s.spot || !s.grid || !s.species) return null;
  try {
    return buildBrief({ species: s.species, spot: s.spot, grid: s.grid, hourIndex: s.hourIndex, hunter: s.hunter ?? undefined, weapon: s.weapon ?? undefined, timeZone: TZ });
  } catch {
    return null;
  }
}

export { offlineRead };
