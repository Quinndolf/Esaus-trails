import { describe, expect, it } from 'vitest';
import { angleDiff, bearingBetween, cellAt, stepYards, yardsBetween } from '../geo';
import { checkApproach, computeScent, resample, ScentDriver, tracePlume } from '../scent';
import { sunPosition, sunTimes } from '../sun';
import { analyzeTerrain } from '../terrain';
import { computeThermals } from '../thermal';
import { computeWind } from '../wind';
import type { WeatherHour } from '../types';
import { CENTER, hour, KY_11AM, KY_2AM, makeGrid, ridge, southFace } from './fixtures';

function fields(grid = southFace(), date = KY_11AM, w: Partial<WeatherHour> = {}) {
  const t = analyzeTerrain(grid);
  const weather = hour(date.toISOString(), w);
  const thermal = computeThermals(t, {
    date,
    sun: sunPosition(date, 37.5, -85.5),
    sunTimes: sunTimes(date, 37.5, -85.5),
    weather,
  });
  const wind = computeWind(t, weather);
  const scent = computeScent(t, wind, thermal, weather);
  return { t, thermal, wind, scent, i: cellAt(t.grid, CENTER)! };
}

describe('wind over ground', () => {
  it('is faster on the ridge than down the side, and sheltered on the lee', () => {
    const { t, wind } = fields(ridge(0.5), KY_11AM, { windMph: 12, windFrom: 270 });
    const crest = cellAt(t.grid, CENTER)!;
    const lee = cellAt(t.grid, [CENTER[0] + 0.004, CENTER[1]])!; // east side, west wind
    const windward = cellAt(t.grid, [CENTER[0] - 0.004, CENTER[1]])!;
    expect(wind.mph[crest]).toBeGreaterThan(wind.mph[lee]);
    expect(wind.sheltered[lee]).toBe(1);
    expect(wind.eddy[lee]).toBe(1);
    expect(wind.sheltered[windward]).toBe(0);
  });
});

describe('scent drift', () => {
  it('follows a real wind downwind', () => {
    const { scent, i } = fields(
      makeGrid(() => 200),
      KY_11AM,
      { windMph: 10, windFrom: 270 },
    );
    expect(scent.driver[i]).toBe(ScentDriver.Wind);
    expect(angleDiff(scent.driftBearing[i], 90)).toBeLessThan(1);
  });

  it('follows the thermal when the air is calm', () => {
    const day = fields(southFace(), KY_11AM, { windMph: 0.5, windFrom: 180 });
    expect(day.scent.driver[day.i]).toBe(ScentDriver.Thermal);
    expect(angleDiff(day.scent.driftBearing[day.i], 0)).toBeLessThan(10); // up the south face
    const night = fields(southFace(), KY_2AM, { windMph: 0.5, windFrom: 0 });
    expect(angleDiff(night.scent.driftBearing[night.i], 180)).toBeLessThan(10); // down it
  });

  it('swirls when a light wind fights the thermal', () => {
    // A 7 mph north wind pushes scent south; the late-morning thermal pulls it north up the face.
    const { scent, i } = fields(southFace(0.4), KY_11AM, { windMph: 7, windFrom: 0 });
    expect(scent.driver[i]).toBe(ScentDriver.Swirl);
    expect(scent.spreadDeg[i]).toBeGreaterThan(100);
  });

  it('traces a plume downwind and stops at the grid edge or when it fades', () => {
    const { t, scent } = fields(
      makeGrid(() => 200),
      KY_11AM,
      { windMph: 10, windFrom: 270 },
    );
    const p = tracePlume(t, scent, CENTER, { maxYards: 400 });
    expect(p.reachYards).toBeGreaterThan(300);
    const last = p.path[p.path.length - 1];
    expect(angleDiff(bearingBetween(CENTER, last), 90)).toBeLessThan(2);
    expect(p.ring[0]).toEqual(p.ring[p.ring.length - 1]);
    const far = tracePlume(t, scent, CENTER, { maxYards: 5000 });
    expect(['edge', 'faded']).toContain(far.end);
  });

  it('carries less far when rising thermals lift scent off the ground', () => {
    const calmUp = fields(southFace(), KY_11AM, { windMph: 0.5 });
    const calmDown = fields(southFace(), KY_2AM, { windMph: 0.5 });
    expect(calmUp.scent.decay[calmUp.i]).toBeGreaterThan(calmDown.scent.decay[calmDown.i]);
  });
});

describe('walk-in check', () => {
  const flat = () =>
    fields(
      makeGrid(() => 200),
      KY_11AM,
      { windMph: 10, windFrom: 270 },
    );
  const route = [stepYards(CENTER, 180, 300), stepYards(CENTER, 0, 300)]; // walking north past the center

  it('warns when the bed is downwind of the route', () => {
    const { t, scent, thermal } = flat();
    const bed = stepYards(CENTER, 90, 200);
    const r = checkApproach(t, scent, thermal, route, [bed]);
    expect(r.level).toBe('warn');
    expect(r.title).toMatch(/Wind is blowing you into a bed/);
    expect(r.detail).toMatch(/east/);
  });

  it('is clear when the bed is upwind', () => {
    const { t, scent, thermal } = flat();
    const r = checkApproach(t, scent, thermal, route, [stepYards(CENTER, 270, 200)]);
    expect(r.level).toBe('clear');
  });

  it('asks for a route and beds first', () => {
    const { t, scent, thermal } = flat();
    expect(checkApproach(t, scent, thermal, [CENTER], [CENTER]).level).toBe('idle');
    expect(checkApproach(t, scent, thermal, route, []).level).toBe('idle');
  });

  it('resamples a route evenly', () => {
    const pts = resample(route, 70);
    expect(pts.length).toBeGreaterThanOrEqual(9);
    for (let k = 1; k < pts.length - 1; k++) expect(yardsBetween(pts[k - 1], pts[k])).toBeCloseTo(70, 0);
  });
});
