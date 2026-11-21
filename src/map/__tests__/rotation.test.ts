import { describe, expect, it } from 'vitest';
import { followBearing, showNorthButton, turnedOffNorth } from '../rotation';

describe('map rotation', () => {
  it('measures how far the map is turned', () => {
    expect(turnedOffNorth(0)).toBe(0);
    expect(turnedOffNorth(350)).toBe(-10);
    expect(turnedOffNorth(-190)).toBe(170);
    expect(turnedOffNorth(720)).toBe(0);
  });
  it('shows the north button only when turned', () => {
    expect(showNorthButton(0)).toBe(false);
    expect(showNorthButton(0.4)).toBe(false);
    expect(showNorthButton(359.6)).toBe(false);
    expect(showNorthButton(30)).toBe(true);
    expect(showNorthButton(-90)).toBe(true);
  });
  it('keeps the hunter\'s turn while following, and goes heading-up in compass mode', () => {
    expect(followBearing('follow', 90, 45)).toBe(45);
    expect(followBearing('free', null, 45)).toBe(45);
    expect(followBearing('compass', 90, 45)).toBe(90);
    expect(followBearing('compass', null, 45)).toBe(45);
  });
});
