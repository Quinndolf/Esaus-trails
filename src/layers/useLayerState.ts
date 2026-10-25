import { useCallback, useState } from 'react';
import { DEFAULT_ON } from './registry';
import type { LayerState } from './types';

const KEY = 'esau-layers';

function load(): LayerState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LayerState>;
      return { on: parsed.on ?? {}, options: parsed.options ?? {} };
    }
  } catch {
    /* ignore */
  }
  return { on: Object.fromEntries(DEFAULT_ON.map((id) => [id, true])), options: {} };
}

/** Which layers are on and which view options are picked, remembered between visits. */
export function useLayerState() {
  const [state, setState] = useState<LayerState>(load);

  const update = useCallback((fn: (s: LayerState) => LayerState) => {
    setState((prev) => {
      const next = fn(prev);
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const toggle = useCallback(
    (id: string, on?: boolean) => update((s) => ({ ...s, on: { ...s.on, [id]: on ?? !s.on[id] } })),
    [update],
  );

  const setOptions = useCallback(
    (id: string, optionIds: string[]) => update((s) => ({ ...s, options: { ...s.options, [id]: optionIds } })),
    [update],
  );

  return { state, toggle, setOptions };
}
