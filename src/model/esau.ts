import type { ThermalFn } from '../esau/conditions';
import type { GroundGrid } from '../esau/types';
import { createConditionsModel, type ConditionsModel } from './conditions';
import type { Forecast, WeatherHour } from './types';

/**
 * Plugs this model into Esau's `readConditions(..., { thermal: modelThermal })`
 * in place of the prototype's rule set. One conditions model is built per grid
 * and reused for every cell and hour Esau asks about.
 */

// NLCD class -> rough canopy %, for when the grid carries cover but no tree canopy layer.
const NLCD_CANOPY: Record<number, number> = { 41: 75, 42: 80, 43: 75, 90: 65, 52: 20, 95: 10 };

const STATES = ['settled', 'rising', 'sinking', 'pooling'] as const;
const models = new WeakMap<GroundGrid, ConditionsModel>();

export function forecastFromGrid(grid: GroundGrid): Forecast {
  const hours: WeatherHour[] = grid.weather.hours.map((h) => ({
    at: new Date(h.at).toISOString(),
    tempF: h.tempF,
    windMph: h.windMph,
    windFrom: h.windFrom,
    gustMph: h.gustMph,
    skyCoverPct: h.skyCover,
  }));
  return {
    source: /open-meteo/i.test(grid.weather.source) ? 'open-meteo' : 'nws',
    lat: (grid.south + grid.north) / 2,
    lon: (grid.west + grid.east) / 2,
    fetchedAt: hours[0]?.at ?? new Date().toISOString(),
    hours,
  };
}

export function conditionsForGrid(grid: GroundGrid): ConditionsModel {
  let m = models.get(grid);
  if (!m) {
    const canopyPct = grid.cover?.length ? grid.cover.map((c) => NLCD_CANOPY[c] ?? 0) : undefined;
    m = createConditionsModel({ ...grid, canopyPct }, forecastFromGrid(grid));
    models.set(grid, m);
  }
  return m;
}

/** Sun position comes from the model itself, so the sun arguments are ignored. */
export const modelThermal: ThermalFn = ({ grid, cellIndex, hour }) => {
  const hc = conditionsForGrid(grid).at(new Date(hour.at));
  return STATES[hc.thermal.state[cellIndex]] ?? 'settled';
};
