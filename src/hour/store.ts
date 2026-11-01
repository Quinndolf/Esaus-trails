import { create } from 'zustand';
import type { GroundGrid } from '../esau/types';
import { useEsau } from '../esau/ui/store';
import type { ConditionsModel } from '../model/conditions';
import { conditionsForGrid } from '../model/esau';
import { createMovementModel, type MovementModel } from '../model/movement';
import { fetchGround, type Bbox } from './ground';
import { nearestSavedGround, saveGround } from './groundCache';

export type HourStatus = 'idle' | 'loading' | 'ready' | 'error';

interface HourState {
  status: HourStatus;
  error: string | null;
  grid: GroundGrid | null;
  conditions: ConditionsModel | null;
  movement: MovementModel | null;
  hours: Date[];
  /** The hour the slider points at. Esau's panel follows this. */
  date: Date;
  open: boolean;
  /** When the weather on screen was read, if it is a saved copy because there was no service. */
  staleSince: number | null;
  /** Show the predicted food layer (deer only). */
  showFood: boolean;
  setShowFood(on: boolean): void;
  setDate(d: Date): void;
  setOpen(open: boolean): void;
  load(b: Bbox): Promise<void>;
  /** For tests and offline: take a grid that's already in hand. */
  useGrid(grid: GroundGrid, now?: Date): void;
}

let inflight: AbortController | null = null;

function floorHour(d: Date) {
  return new Date(Math.floor(d.getTime() / 3600e3) * 3600e3);
}

export const useHour = create<HourState>((set, get) => ({
  status: 'idle',
  error: null,
  grid: null,
  conditions: null,
  movement: null,
  hours: [],
  date: floorHour(new Date()),
  open: false,
  staleSince: null,
  showFood: true,
  setShowFood: (showFood) => set({ showFood }),
  setDate: (date) => {
    set({ date });
    // One clock for the whole app: Esau's tap panel reads the same hour.
    useEsau.getState().setTime(date);
  },
  setOpen: (open) => set({ open }),
  useGrid(grid, now = new Date()) {
    // Esau's tap reading and the slider share one conditions model per grid.
    const conditions = conditionsForGrid(grid);
    const movement = createMovementModel(grid);
    const hours = conditions.hours(24, now);
    set({ status: 'ready', error: null, grid, conditions, movement, hours, date: hours[0], open: true, staleSince: null });
  },
  async load(b) {
    inflight?.abort();
    const ac = new AbortController();
    inflight = ac;
    set({ status: 'loading', error: null, open: true });
    try {
      const grid = await fetchGround(b, { signal: ac.signal });
      if (ac.signal.aborted) return;
      get().useGrid(grid);
      saveGround(grid);
    } catch (err) {
      if (ac.signal.aborted) return;
      // No service: fall back to the last ground read near here, and say how old it is.
      const saved = nearestSavedGround([(b.west + b.east) / 2, (b.south + b.north) / 2]);
      if (saved) {
        get().useGrid(saved.grid);
        set({ staleSince: saved.savedAt });
        return;
      }
      set({ status: 'error', error: err instanceof Error ? err.message : String(err) });
    }
  },
}));
