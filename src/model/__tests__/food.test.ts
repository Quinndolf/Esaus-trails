import { describe, expect, it } from 'vitest';
import type { GroundGrid } from '../../esau/types';
import { analyzeFood, foodForSeason, foodSeason, FOREST_GROUP, readFood, type VegetationGrid } from '../food';
import { createMovementModel } from '../movement';
import { sunPosition } from '../sun';
import { BOX, CENTER, hour, makeGrid } from './fixtures';

/** A north-south ridge in oak-able deciduous forest, a creek-bottom hollow to the east, a bean field in the south. */
function woods(extra: Partial<VegetationGrid> = {}): VegetationGrid {
  const g = makeGrid((x, y) => 300 + Math.max(-180, -Math.abs(x + 150) * 0.3) + (x > 250 ? -60 : 0) + y * 0.02);
  const cover: number[] = [];
  const crop: number[] = [];
  for (let r = 0; r < BOX.rows; r++)
    for (let c = 0; c < BOX.cols; c++) {
      const field = r >= 28;
      cover.push(field ? 82 : 41);
      crop.push(field ? 5 : 0);
    }
  return { ...g, elevationM: Array.from(g.elevationM), cover, crop, weather: { source: 'test', hours: [] }, ...extra };
}

describe('food seasons', () => {
  it('moves from browse and crops to acorn drop to winter food through the year', () => {
    expect(foodSeason(new Date(2026, 3, 10))).toBe('spring');
    expect(foodSeason(new Date(2026, 9, 25))).toBe('mast');
    expect(foodSeason(new Date(2026, 11, 20))).toBe('late');
    expect(foodSeason(new Date(2027, 0, 20))).toBe('winter');
  });
});

describe('food prediction', () => {
  const grid = woods();
  const f = analyzeFood(grid);
  const idx = (r: number, c: number) => r * BOX.cols + c;

  it('puts oaks on dry ridge ground and not in the bottoms', () => {
    let ridge = 0, bottom = 0, nr = 0, nb = 0;
    for (let i = 0; i < f.oak.length; i++) {
      if (grid.cover[i] !== 41) continue;
      if (f.terrain.position[i]! > 0.3 && f.terrain.drainage[i]! < 0.4) { ridge += f.oak[i]!; nr++; }
      if (f.terrain.drainage[i]! > 0.55) { bottom += f.oak[i]!; nb++; }
    }
    expect(nr).toBeGreaterThan(0);
    if (nb) expect(ridge / nr).toBeGreaterThan(bottom / nb);
  });

  it('lets forest type override: oak-hickory raises, maple-beech and pine lower', () => {
    const n = grid.cols * grid.rows;
    const mean = (type: number) => {
      const t = analyzeFood({ ...grid, forestType: new Array(n).fill(type) });
      return t.oak.reduce((a, b) => a + b, 0) / n;
    };
    expect(mean(FOREST_GROUP.oakHickory)).toBeGreaterThan(mean(0 as number));
    expect(mean(FOREST_GROUP.mapleBeech)).toBeLessThan(mean(0 as number));
    expect(mean(FOREST_GROUP.pine)).toBeLessThan(mean(FOREST_GROUP.mapleBeech));
  });

  it('thin, stressed canopy bears less mast', () => {
    const n = grid.cols * grid.rows;
    const lush = analyzeFood({ ...grid, greenness: new Array(n).fill(75) });
    const thin = analyzeFood({ ...grid, greenness: new Array(n).fill(30) });
    expect(thin.mast.reduce((a, b) => a + b)).toBeLessThan(lush.mast.reduce((a, b) => a + b));
  });

  it('weights acorns up in the drop and crops up in summer', () => {
    const drop = foodForSeason(f, 'mast');
    const summer = foodForSeason(f, 'summer');
    const timber = idx(8, 16);
    const field = idx(30, 16);
    expect(drop.value[timber]).toBeGreaterThan(summer.value[timber]!);
    expect(summer.kind[field]).toBe(2);
  });

  it('reads a spot honestly, as a prediction', () => {
    const read = readFood(grid, CENTER, new Date(2026, 9, 25))!;
    expect(read.season).toBe('mast');
    expect(read.lines.join(' ')).toMatch(/PREDICTED/);
    expect(read.lines.join(' ')).toMatch(/never promise acorns/);
    expect(read.basis).toContain('topography');
  });
});

describe('food drives movement', () => {
  const grid: GroundGrid = woods();
  const model = createMovementModel(grid);
  const sun = sunPosition(new Date('2026-10-25T17:30:00Z'), 37.5, -85.5);

  it('hands the map a food field that changes with the season', () => {
    const oct = model.at(sun, hour(''), undefined, 1, new Date(2026, 9, 25));
    const jul = model.at(sun, hour(''), undefined, 1, new Date(2026, 6, 25));
    expect(oct.foodSeason).toBe('mast');
    expect(jul.foodSeason).toBe('summer');
    const sum = (a: Float32Array) => a.reduce((x, y) => x + y, 0);
    expect(sum(oct.food)).not.toBe(sum(jul.food));
  });
});
