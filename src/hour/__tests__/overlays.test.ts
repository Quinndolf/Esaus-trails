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
  windArrows,
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
});
