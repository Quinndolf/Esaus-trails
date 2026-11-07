import { describe, expect, it } from 'vitest';
import { isTapSpot } from '../useEsauMap';

describe('isTapSpot', () => {
  it('is true for a tap, which sets the sit spot to the tapped point', () => {
    expect(isTapSpot({ lat: 1, lng: 2 }, { lat: 1, lng: 2 })).toBe(true);
  });
  it('is false for Analyze area, so the map stays put', () => {
    expect(isTapSpot({ lat: 1.001, lng: 2 }, { lat: 1, lng: 2 })).toBe(false);
    expect(isTapSpot({ lat: 1, lng: 2 }, null)).toBe(false);
  });
});
