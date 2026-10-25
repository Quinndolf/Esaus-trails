import { describe, expect, it } from 'vitest';
import type { GroundGrid } from '../../esau/types';
import { cellAt } from '../geo';
import { conditionsForGrid, modelThermal } from '../esau';
import { CENTER, KY_11AM, KY_2AM, southFace } from './fixtures';

function ground(): GroundGrid {
  const g = southFace();
  return {
    ...g,
    elevationM: Array.from(g.elevationM),
    cover: new Array(1024).fill(71),
    crop: new Array(1024).fill(0),
    weather: {
      source: 'NOAA / NWS',
      hours: [KY_2AM, KY_11AM].map((d) => ({
        at: d.toISOString(),
        tempF: 45,
        windMph: 1,
        windFrom: 270,
        skyCover: 10,
      })),
    },
  };
}

describe("Esau's thermal seam", () => {
  it('reads rising at 11 am and sinking at 2 am on a south face', () => {
    const grid = ground();
    const i = cellAt(grid, CENTER)!;
    const call = (h: number) =>
      modelThermal({ grid, cellIndex: i, hour: grid.weather.hours[h], sunAltitudeDeg: 0, sunAzimuthDeg: 0 });
    expect(call(1)).toBe('rising');
    expect(call(0)).toBe('sinking');
  });

  it('builds one model per grid', () => {
    const grid = ground();
    expect(conditionsForGrid(grid)).toBe(conditionsForGrid(grid));
  });
});
