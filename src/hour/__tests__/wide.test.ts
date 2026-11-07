import { describe, expect, it } from 'vitest';
import { CORRIDOR_WEIGHT, corridorsIn, wideBox, wideSummary } from '../wide';
import type { GroundGrid } from '../../esau/types';

const miLat = (b: { south: number; north: number }) => (b.north - b.south) * 69;
const view = { west: -85.71, east: -85.69, south: 36.745, north: 36.755 }; // about 0.7 mi tall

describe('wideBox', () => {
  it('is three screens across, at least 3 and at most 6 miles, centered on the screen', () => {
    const b = wideBox(view);
    expect(miLat(b)).toBeCloseTo(3, 1);
    expect((b.west + b.east) / 2).toBeCloseTo(-85.7, 6);
    const big = wideBox({ west: -85.8, east: -85.6, south: 36.7, north: 36.8 }); // ~7 mi tall screen
    expect(miLat(big)).toBeCloseTo(6, 1);
  });
});

describe('corridorsIn', () => {
  it('keeps the runs of a wide trail that cross the fine ground, lighter', () => {
    const t = { weight: 1, coordinates: [[-85.75, 36.75], [-85.705, 36.75], [-85.7, 36.75], [-85.695, 36.75], [-85.6, 36.75]] as [number, number][] };
    const out = corridorsIn([t], view);
    expect(out).toEqual([{ weight: CORRIDOR_WEIGHT, coordinates: [[-85.705, 36.75], [-85.7, 36.75], [-85.695, 36.75]] }]);
    expect(corridorsIn([{ weight: 1, coordinates: [[-85.75, 36.75], [-85.74, 36.75]] }], view)).toEqual([]);
  });
});

describe('wideSummary', () => {
  // A 4x4 wide grid: west half woods, east half crop fields.
  const grid = {
    west: -85.74, east: -85.66, south: 36.73, north: 36.77, cols: 4, rows: 4,
    elevationM: new Array(16).fill(250),
    cover: Array.from({ length: 16 }, (_, i) => (i % 4 < 2 ? 41 : 82)),
    crop: new Array(16).fill(0),
  } as unknown as GroundGrid;

  it('says what lies each way, where deer bed beyond the screen, and where corridors come in', () => {
    const move = {
      beds: [{ lngLat: [-85.73, 36.765] as [number, number], score: 0.9, elevationFt: 900 }, { lngLat: [-85.7, 36.75] as [number, number], score: 1, elevationFt: 900 }],
      trails: [{ weight: 1, coordinates: [[-85.73, 36.765], [-85.715, 36.752], [-85.7, 36.75]] as [number, number][] }],
    };
    const lines = wideSummary(grid, move, view).join('\n');
    expect(lines).toMatch(/WIDER COUNTRY/);
    expect(lines).toMatch(/west: mostly woods/);
    expect(lines).toMatch(/east: mostly crop fields/);
    expect(lines).toMatch(/Likely bedding beyond the screen: \d+ yd northwest/);
    expect(lines).toMatch(/Likely bedding beyond the screen: \d+ yd northwest \(/); // the bed on screen isn't listed
    expect(lines).toMatch(/corridors crossing the screen.s edge: 1 from the west/);
  });

  it('says so when no corridor comes in', () => {
    expect(wideSummary(grid, { beds: [], trails: [] }, view).join('\n')).toMatch(/No predicted travel corridors cross/);
  });
});

describe('corridors next to fine trails', () => {
  it('drops corridor points in or beside a cell the fine read already has a trail in', async () => {
    const { makeGrid, BOX } = await import('../../model/__tests__/fixtures');
    const { cellCenter } = await import('../../model/geo');
    const g = makeGrid(() => 250);
    const at = (r: number, c: number) => cellCenter(g, r * BOX.cols + c) as [number, number];
    const fine = { weight: 1, coordinates: Array.from({ length: 10 }, (_, k) => at(10, 5 + k)) };
    // A corridor running alongside one row over (same path, coarser), then going on its own way.
    const wide = { weight: 1, coordinates: [...Array.from({ length: 10 }, (_, k) => at(11, 5 + k)), at(14, 16), at(18, 16), at(22, 16)] };
    const out = corridorsIn([wide], g, { grid: g, trails: [fine] });
    expect(out.flatMap((t) => t.coordinates)).toEqual([at(14, 16), at(18, 16), at(22, 16)]);
  });
});
