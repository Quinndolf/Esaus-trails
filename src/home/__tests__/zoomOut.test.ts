import { describe, expect, it, vi } from 'vitest';
import { zoomOutTo } from '../AnalyzePill';
import { useEsau } from '../../esau/ui/store';

function fakeMap(box = { w: -85.51, e: -85.49, s: 37.49, n: 37.51 }, land = true) {
  const once: Record<string, () => void> = {};
  const fits: unknown[] = [];
  return {
    fits,
    map: {
      getBearing: () => 0,
      getPitch: () => 0,
      getZoom: () => 15,
      getBounds: () => ({ getWest: () => box.w, getEast: () => box.e, getSouth: () => box.s, getNorth: () => box.n }),
      once: (ev: string, fn: () => void) => void (once[ev] = fn),
      fitBounds(b: [[number, number], [number, number]], o: unknown) {
        fits.push({ b, o });
        box = { w: b[0][0], s: b[0][1], e: b[1][0], n: b[1][1] };
        if (land) once.moveend?.();
      },
    },
  };
}

describe('zoomOutTo', () => {
  it('fits the screen plus the spot, never zooms in, and updates Esau\'s view', async () => {
    const f = fakeMap();
    await zoomOutTo(f.map as never, [-85.5, 37.52]);
    expect(f.fits).toHaveLength(1);
    expect((f.fits[0] as { o: { maxZoom: number } }).o.maxZoom).toBe(15);
    expect(useEsau.getState().view!.north).toBeGreaterThan(37.52);
  });
  it('gives up waiting if the map never says it landed', async () => {
    vi.useFakeTimers();
    const f = fakeMap(undefined, false);
    const p = zoomOutTo(f.map as never, [-85.5, 37.52]);
    await vi.advanceTimersByTimeAsync(2100);
    await p;
    vi.useRealTimers();
    expect(f.fits.length).toBeGreaterThan(0);
  });
});
