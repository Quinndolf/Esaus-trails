import { create } from 'zustand';
import { useEsau } from '../esau/ui/store';
import type { GroundGrid } from '../esau/types';
import { bboxAround, fetchGround } from '../hour/ground';

const SEEN_KEY = 'esau-ginseng-rules-seen';

interface GinsengState {
  grid: GroundGrid | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  rulesOpen: boolean;
  howtoOpen: boolean;
  gearOpen: boolean;
  setGearOpen(open: boolean): void;
  setHowtoOpen(open: boolean): void;
  setRulesOpen(open: boolean): void;
  /** Switch Esau to ginseng and read the ground around `center` ([lng, lat]). */
  enter(center: [number, number] | null): void;
  exit(): void;
  load(center: [number, number]): Promise<void>;
}

let ticket = 0;

function seen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

export const useGinseng = create<GinsengState>((set, get) => ({
  grid: null,
  status: 'idle',
  error: null,
  rulesOpen: false,
  howtoOpen: false,
  gearOpen: false,
  setGearOpen: (gearOpen) => set({ gearOpen }),
  setHowtoOpen: (howtoOpen) => set({ howtoOpen }),

  setRulesOpen(rulesOpen) {
    if (!rulesOpen) {
      try {
        localStorage.setItem(SEEN_KEY, '1');
      } catch {
        /* ignore */
      }
    }
    set({ rulesOpen });
  },

  enter(center) {
    const esau = useEsau.getState();
    if (esau.species !== 'ginseng') esau.setSpecies('ginseng');
    // First time in, the law comes before the map.
    if (!seen()) set({ rulesOpen: true });
    const { grid, status } = get();
    if (center && !grid && status !== 'loading') void get().load(center);
  },

  exit() {
    // Ginseng is one of the things the hunter can be after; leaving it means choosing again.
    useEsau.getState().setSpecies(null);
    useEsau.getState().setChoosing(true);
    set({ rulesOpen: false, howtoOpen: false });
  },

  async load(center) {
    const mine = ++ticket;
    set({ status: 'loading', error: null });
    try {
      const grid = await fetchGround(bboxAround(center));
      if (mine === ticket) set({ grid, status: 'ready' });
    } catch (err) {
      if (mine === ticket) set({ status: 'error', error: err instanceof Error ? err.message : "Couldn't read this ground" });
    }
  },
}));
