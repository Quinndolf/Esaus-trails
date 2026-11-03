import { describe, expect, it, vi } from 'vitest';
import { aboveSheetOffset, recenterOn } from '../geo';

describe('sheet recentering', () => {
  it('puts the point in the middle of the uncovered strip above an 85% sheet', () => {
    const [, dy] = aboveSheetOffset(800);
    // map center is y=400; strip is y 0..120, so the point should land at y=60
    expect(400 + dy).toBeCloseTo(60);
  });
  it('recenters on the point with no offset, keeping zoom', () => {
    const flyTo = vi.fn();
    recenterOn({ getZoom: () => 16.5, flyTo }, [-85.7, 37.5]);
    expect(flyTo).toHaveBeenCalledWith({ center: [-85.7, 37.5], zoom: 16.5, offset: [0, 0] });
  });
});

import { panShiftAboveSheet } from '../geo';

describe('tapped spot stays visible above a bottom panel', () => {
  it('leaves a spot in the uncovered strip alone', () => {
    expect(panShiftAboveSheet(150, 800, 0.52)).toBe(0);
  });
  it('lifts a spot hidden behind the panel into the middle of the strip', () => {
    // strip is y 0..384, so the spot at y=600 should move to y=192
    expect(panShiftAboveSheet(600, 800, 0.52)).toBeCloseTo(408);
  });
  it('lifts a spot that sits too close to the panel edge', () => {
    expect(panShiftAboveSheet(370, 800, 0.52)).toBeGreaterThan(0);
  });
});
