// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { gpsWanted, useGeolocation } from '../useGeolocation';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('when GPS runs', () => {
  it('runs while following, in compass mode or recording a track; stops when idle or hidden', () => {
    expect(gpsWanted({ mode: 'follow', recording: false, visible: true })).toBe(true);
    expect(gpsWanted({ mode: 'compass', recording: false, visible: true })).toBe(true);
    expect(gpsWanted({ mode: 'free', recording: false, visible: true })).toBe(false);
    expect(gpsWanted({ mode: 'free', recording: true, visible: true })).toBe(true);
    expect(gpsWanted({ mode: 'follow', recording: false, visible: false })).toBe(false);
    expect(gpsWanted({ mode: 'free', recording: true, visible: false })).toBe(true); // a tracked hunt keeps going
  });
});

describe('useGeolocation(active)', () => {
  const watch = vi.fn(() => 7);
  const clear = vi.fn();
  beforeEach(() => {
    watch.mockClear();
    clear.mockClear();
    vi.stubGlobal('navigator', { geolocation: { watchPosition: watch, clearWatch: clear } });
  });
  afterEach(() => vi.unstubAllGlobals());

  function Probe({ active }: { active: boolean }) {
    useGeolocation(active);
    return null;
  }

  it('starts the watch only while active and releases it when not', async () => {
    const root = createRoot(document.createElement('div'));
    await act(async () => root.render(createElement(Probe, { active: false })));
    expect(watch).not.toHaveBeenCalled();
    await act(async () => root.render(createElement(Probe, { active: true })));
    expect(watch).toHaveBeenCalledOnce();
    await act(async () => root.render(createElement(Probe, { active: false })));
    expect(clear).toHaveBeenCalledWith(7);
  });
});
