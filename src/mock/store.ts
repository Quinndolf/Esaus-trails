import { create } from 'zustand';
import type { LngLat } from '../map/geo';

export const MOCK_HOLD_MS = 500;
export const MOCK_SLOP_PX = 8;

/** Pure rule for the gesture: hold still for half a second to drop the spot; moving first means pan. */
export function mockHoldDecision(s: { heldMs: number; movedPx: number }): 'wait' | 'drop' | 'cancel' {
  if (s.movedPx > MOCK_SLOP_PX) return 'cancel';
  return s.heldMs >= MOCK_HOLD_MS ? 'drop' : 'wait';
}

let suppressUntil = 0;
/** True just after a hold, so the map tap that follows the finger lifting doesn't also analyze the spot. */
export const justHeld = () => Date.now() < suppressUntil;

interface MockState {
  /** Where the hunter is pretending to stand. Null means use the real GPS. */
  pos: LngLat | null;
  drop(at: LngLat): void;
  clear(): void;
}

export const useMock = create<MockState>((set) => ({
  pos: null,
  drop: (at) => {
    suppressUntil = Date.now() + 600;
    set({ pos: at });
  },
  clear: () => set({ pos: null }),
}));
