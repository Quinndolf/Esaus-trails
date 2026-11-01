import { create } from 'zustand';

export const UNDO_MS = 5000;

interface Pending {
  title: string;
  timer: ReturnType<typeof setTimeout>;
}

interface UndoState {
  /** Marks hidden from the list while their delete waits out the undo window. */
  pending: Record<string, Pending>;
  schedule(id: string, title: string, commit: () => void | Promise<void>): void;
  undo(id: string): void;
}

export const useUndoDeletes = create<UndoState>((set, get) => ({
  pending: {},
  schedule(id, title, commit) {
    const old = get().pending[id];
    if (old) clearTimeout(old.timer);
    const timer = setTimeout(() => {
      const { [id]: _gone, ...rest } = get().pending;
      set({ pending: rest });
      void commit();
    }, UNDO_MS);
    set({ pending: { ...get().pending, [id]: { title, timer } } });
  },
  undo(id) {
    const p = get().pending[id];
    if (!p) return;
    clearTimeout(p.timer);
    const { [id]: _gone, ...rest } = get().pending;
    set({ pending: rest });
  },
}));
