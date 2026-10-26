import { speciesBrain } from '../esau/species';
import { readSpot } from '../esau/terrain';
import type { ConditionsReading, GroundGrid, SpeciesId, SpotReading } from '../esau/types';
import type { HourConditions } from '../model/conditions';

/**
 * Where the hunted animal is likely to be this hour, for every animal that has no hourly movement model
 * of its own (whitetail has one). Each cell is scored by that animal's rules for resting, feeding and
 * travel ground, then blended by what the animal is doing at this hour of the day.
 */

interface CellScores {
  rest: number;
  feed: number;
  travel: number;
}

const spots = new WeakMap<GroundGrid, SpotReading[]>();

function spotsFor(grid: GroundGrid): SpotReading[] {
  let s = spots.get(grid);
  if (!s) {
    s = [];
    const dLat = (grid.north - grid.south) / grid.rows;
    const dLng = (grid.east - grid.west) / grid.cols;
    for (let r = 0; r < grid.rows; r++)
      for (let c = 0; c < grid.cols; c++)
        s.push(readSpot(grid, { lat: grid.north - (r + 0.5) * dLat, lng: grid.west + (c + 0.5) * dLng }));
    spots.set(grid, s);
  }
  return s;
}

/** What share of the animal's time at this hour goes to resting, feeding and moving between the two. */
export function hourWeights(species: SpeciesId, alt: number, azimuth: number): CellScores {
  const morning = azimuth < 180;
  if (species === 'squirrel' || species === 'turkey') {
    if (alt < -3) return { rest: 1, feed: 0, travel: 0 }; // den or roost
    if (morning && alt < 30) return { rest: 0, feed: 0.7, travel: 0.3 };
    if (!morning && alt < 22) return { rest: 0.15, feed: 0.6, travel: 0.25 };
    return { rest: 0.3, feed: 0.4, travel: 0.3 };
  }
  if (alt < -10) return { rest: 0.2, feed: 0.6, travel: 0.2 };
  if (alt < 14) return { rest: 0.2, feed: 0.4, travel: 0.4 }; // dawn and dusk
  return { rest: 0.7, feed: 0.15, travel: 0.15 };
}

/** 0-1 per cell, row-major from the north edge, scaled so the likeliest cell is 1. */
export function likelihoodField(grid: GroundGrid, species: SpeciesId, hc: HourConditions): Float32Array | null {
  const brain = speciesBrain(species);
  if (!brain) return null;
  const w = hourWeights(species, hc.sun.altitude, hc.sun.azimuth);
  const cond = { windMph: hc.weather.windMph, windFrom: hc.weather.windFrom, tempF: hc.weather.tempF } as ConditionsReading;
  const phase = brain.phase(hc.date, (grid.south + grid.north) / 2);
  const out = new Float32Array(grid.cols * grid.rows);
  let top = 0.001;
  spotsFor(grid).forEach((spot, i) => {
    const s = brain.scores(spot, cond, phase);
    const v = w.rest * s.bedding + w.feed * s.feeding + w.travel * s.travel;
    out[i] = v;
    if (v > top) top = v;
  });
  for (let i = 0; i < out.length; i++) out[i] /= top;
  return out;
}
