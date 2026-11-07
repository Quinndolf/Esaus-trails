import { describe, expect, it } from 'vitest';
import { createConditionsModel } from '../../model/conditions';
import { createMovementModel } from '../../model/movement';
import { tracePlume } from '../../model/scent';
import { CENTER, KY_11AM, southFace, steadyForecast } from '../../model/__tests__/fixtures';
import { bboxAround } from '../ground';
import {
  bedPoints,
  imageCorners,
  plumePolygon,
  presencePixels,
  thermalPixels,
  trailLines,
  clipTrails,
  windArrows,
  STRONG_WIND_MPH,
} from '../overlays';

describe('hour overlays', () => {
  const grid = southFace();
  const ground = {
    ...grid,
    elevationM: Array.from(grid.elevationM),
    cover: new Array(1024).fill(41),
    crop: new Array(1024).fill(0),
    weather: { source: 't', hours: [] },
  };
  const c = createConditionsModel(grid, steadyForecast({ windMph: 8, windFrom: 270 }));
  const hc = c.at(KY_11AM);
  const m = createMovementModel(ground).at(hc.sun, hc.weather, hc.wind);

  it('paints one RGBA pixel per cell, transparent where the air is settled', () => {
    const px = thermalPixels(hc);
    expect(px.length).toBe(1024 * 4);
    expect(px[3 + 4 * 500]).toBeGreaterThan(0);
    expect(presencePixels(m).length).toBe(1024 * 4);
  });

  it('places images by grid corners, north-west first', () => {
    expect(imageCorners(grid)[0]).toEqual([grid.west, grid.north]);
    expect(imageCorners(grid)[2]).toEqual([grid.east, grid.south]);
  });

  it('draws downwind arrows and a closed scent cone', () => {
    const arrows = windArrows(grid, hc);
    expect(arrows.features.length).toBeGreaterThan(20);
    const [tail, tip] = (arrows.features[0].geometry as GeoJSON.LineString).coordinates;
    expect(tip[0]).toBeGreaterThan(tail[0]); // west wind blows east
    const cone = plumePolygon(tracePlume(c.terrain, hc.scent, CENTER));
    const ring = (cone.features[0].geometry as GeoJSON.Polygon).coordinates[0];
    expect(ring[0]).toEqual(ring[ring.length - 1]);
    expect(plumePolygon(null).features).toEqual([]);
  });

  it('emits trails and beds as GeoJSON', () => {
    expect(trailLines(m).type).toBe('FeatureCollection');
    expect(bedPoints(m).type).toBe('FeatureCollection');
  });

  it("reads the prototype's footprint around a point", () => {
    const b = bboxAround([-85.5, 37.5]);
    expect(b.east - b.west).toBeCloseTo(0.06);
    expect(b.north - b.south).toBeCloseTo(0.044);
  });

  it('shows wind strength by shape, not color: width grows with speed, capped', () => {
    expect(STRONG_WIND_MPH).toBe(10);
    const widths = windArrows(grid, hc).features.map((f) => f.properties!.width as number);
    expect(Math.min(...widths)).toBeGreaterThan(1.7);
    expect(Math.max(...widths)).toBeLessThanOrEqual(4.5);
  });
});

describe('trails and beds stay on the screen', () => {
  const view = { west: 0, east: 10, south: 0, north: 10 };
  const m = {
    trails: [
      { coordinates: [[-5, 5], [1, 5], [5, 5], [9, 5], [15, 5], [20, 5], [9, 6], [8, 6]], weight: 1 },
      { coordinates: [[20, 20], [30, 30]], weight: 1 },
    ],
    beds: [{ lngLat: [5, 5], score: 0.9 }, { lngLat: [50, 5], score: 0.9 }],
    activity: { moving: 0.5, bedded: 0.5 },
  } as never;

  it('cuts each trail to the stretches on screen, splitting where it leaves and comes back', () => {
    const t = clipTrails((m as { trails: never[] }).trails, view);
    expect(t.map((x: { coordinates: number[][] }) => x.coordinates)).toEqual([
      [[1, 5], [5, 5], [9, 5]],
      [[9, 6], [8, 6]],
    ]);
  });
  it('draws only on-screen trails and beds, and everything with no screen known', () => {
    expect(trailLines(m, view).features).toHaveLength(2);
    expect(bedPoints(m, view).features).toHaveLength(1);
    expect(trailLines(m).features).toHaveLength(2 + 0); // unclipped: both trails
    expect(bedPoints(m).features).toHaveLength(2);
  });
});
