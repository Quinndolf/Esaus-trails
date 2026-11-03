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
