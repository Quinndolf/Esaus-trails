import type { ElevationGrid, Forecast, WeatherHour } from '../types';

/** About 1.3 x 1.3 km of ground in central Kentucky, 32x32 cells of ~41 m, like the prototype's grid. */
export const BOX = { west: -85.5075, east: -85.4925, south: 37.494, north: 37.506, cols: 32, rows: 32 };

export function makeGrid(f: (x: number, y: number) => number, extra: Partial<ElevationGrid> = {}): ElevationGrid {
  const { cols, rows } = BOX;
  const elevationM: number[] = [];
  // x, y in meters from the center; y grows north.
  const cellX = ((BOX.east - BOX.west) / cols) * 111320 * Math.cos((37.5 * Math.PI) / 180);
  const cellY = ((BOX.north - BOX.south) / rows) * 111320;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = (c + 0.5 - cols / 2) * cellX;
      const y = (rows / 2 - r - 0.5) * cellY;
      elevationM.push(f(x, y));
    }
  }
  return { ...BOX, elevationM, ...extra };
}

/** One face rising to the north at `pct` grade: it faces south. */
export const southFace = (pct = 0.25) => makeGrid((_x, y) => 250 + y * pct);

/** A V-shaped hollow running north-south, sides at `pct` grade, with a gentle fall to the south. */
export const hollow = (pct = 0.3) => makeGrid((x, y) => 220 + Math.abs(x) * pct + y * 0.03);

/** A north-south ridge, sides falling east and west. */
export const ridge = (pct = 0.3) => makeGrid((x) => 400 - Math.abs(x) * pct);

export const CENTER: [number, number] = [-85.5, 37.5];

export function hour(at: string, w: Partial<WeatherHour> = {}): WeatherHour {
  return { at, tempF: 45, windMph: 0, windFrom: 270, gustMph: 0, skyCoverPct: 0, ...w };
}

/** 48 steady hours starting 2026-10-25 00:00 UTC. */
export function steadyForecast(w: Partial<WeatherHour> = {}): Forecast {
  const t0 = Date.parse('2026-10-25T00:00:00Z');
  return {
    source: 'nws',
    lat: 37.5,
    lon: -85.5,
    fetchedAt: '2026-10-25T00:00:00Z',
    hours: Array.from({ length: 48 }, (_, k) => hour(new Date(t0 + k * 3600e3).toISOString(), w)),
  };
}

// Kentucky, 2026-10-25 (EDT = UTC-4). Sunrise is a little after 8 local, sunset near 6:50 pm.
export const KY_11AM = new Date('2026-10-25T15:00:00Z');
export const KY_2AM = new Date('2026-10-25T06:00:00Z');
export const KY_8_30AM = new Date('2026-10-25T12:30:00Z');
