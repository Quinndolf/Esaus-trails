// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { useScreenView } from '../AnalyzePill';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function Probe({ map }: { map: never }) {
  useScreenView(map);
  return null;
}
import { useEsau } from '../../esau/ui/store';

function fakeMap() {
  let box = { w: -85.705, e: -85.695, s: 36.745, n: 36.755 };
  const handlers: Record<string, () => void> = {};
  return {
    pan(next: typeof box) {
      box = next;
      handlers.moveend?.();
    },
    map: {
      getBearing: () => 0,
      getPitch: () => 0,
      getBounds: () => ({ getWest: () => box.w, getEast: () => box.e, getSouth: () => box.s, getNorth: () => box.n }),
      on: (ev: string, fn: () => void) => void (handlers[ev] = fn),
      off: (ev: string) => void delete handlers[ev],
    },
    handlers,
  };
}

describe('useScreenView', () => {
  it('keeps Esau on the screen the hunter is looking at, as they pan and zoom', async () => {
    useEsau.setState({ view: null });
    const f = fakeMap();
    const root = createRoot(document.createElement('div'));
    await act(async () => root.render(createElement(Probe, { map: f.map as never })));
    const unmount = () => act(() => root.unmount());
    expect(useEsau.getState().view).toEqual({ west: -85.705, east: -85.695, south: 36.745, north: 36.755 });
    act(() => f.pan({ w: -85.705, e: -85.7, s: 36.745, n: 36.75 })); // zoomed in
    expect(useEsau.getState().view).toEqual({ west: -85.705, east: -85.7, south: 36.745, north: 36.75 });
    unmount();
    expect(f.handlers.moveend).toBeUndefined();
  });
});

describe('useScreenView when zoomed out', () => {
  it('keeps Esau to a walkable box at the middle of a wide screen', async () => {
    const { REACH_MI } = await import('../../hour/ground');
    const f = fakeMap();
    const wide = { ...f.map, getBounds: () => ({ getWest: () => -86, getEast: () => -85, getSouth: () => 36.5, getNorth: () => 37 }) };
    const root = createRoot(document.createElement('div'));
    await act(async () => root.render(createElement(Probe, { map: wide as never })));
    const v = useEsau.getState().view!;
    expect((v.north - v.south) * 69).toBeCloseTo(REACH_MI, 1);
    act(() => root.unmount());
  });
});
