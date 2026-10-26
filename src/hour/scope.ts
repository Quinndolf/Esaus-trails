import type { SpeciesId } from '../esau/types';
import { speciesBrain } from '../esau/species';
import { cellAt } from '../model/geo';
import type { HourConditions } from '../model/conditions';
import type { LngLat } from '../map/geo';
import type { ElevationGrid } from '../model/types';
import { THERMAL_WORDS } from '../model/describe';

/**
 * What the hour slider shows for each hunted animal. Nothing from another animal's playbook appears:
 * thermals and scent only for animals that hunt by nose, the deer movement model only for deer.
 */
export interface HourScope {
  thermals: boolean;
  scent: boolean;
  /** Bedding, trails and "where deer are likely" from the whitetail model. */
  movement: boolean;
  /** What the day-strip under the slider shows. */
  strip: 'thermal' | 'activity';
  noun: string;
}

const scopeCache = new Map<SpeciesId, HourScope | null>();

/** Cached so the same animal always gets the same object: React store selectors loop forever on a fresh one each call. */
export function hourScope(species: SpeciesId | null): HourScope | null {
  if (!species) return null;
  if (!scopeCache.has(species)) scopeCache.set(species, buildScope(species));
  return scopeCache.get(species)!;
}

function buildScope(species: SpeciesId): HourScope | null {
  const brain = speciesBrain(species);
  if (!brain || brain.plant) return null; // ginseng: nothing moves by the hour
  if (species === 'whitetail') return { thermals: true, scent: true, movement: true, strip: 'thermal', noun: 'Deer' };
  if (brain.nose) return { thermals: true, scent: true, movement: false, strip: 'thermal', noun: brain.name };
  return { thermals: false, scent: false, movement: false, strip: 'activity', noun: brain.name };
}

export interface Activity {
  /** 0-1 */
  level: number;
  line: string;
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** A rough day shape for animals the deer movement model doesn't cover. Null where there isn't one. */
export function activityFor(species: SpeciesId | null, hc: HourConditions): Activity | null {
  const { altitude: alt, azimuth: az } = hc.sun;
  const w = hc.weather;
  const morning = az < 180;
  const windy = w.windMph >= 15;

  if (species === 'squirrel') {
    let level: number;
    let line: string;
    if (alt < -3) {
      level = 0;
      line = 'Dark. Squirrels are denned up.';
    } else if (morning && alt < 28) {
      level = 0.95;
      line = 'First light. This is the hour: squirrels are out cutting nuts. Be still and listen.';
    } else if (!morning && alt < 22) {
      level = 0.7;
      line = 'Evening feed. A second wave of cutting before they go to den.';
    } else if (w.tempF <= 40) {
      level = 0.55;
      line = 'Cold day: the warm middle of the day moves them. Watch the oak flats.';
    } else if (w.tempF >= 85) {
      level = 0.15;
      line = 'Hot midday. Squirrels are laid out in the shade. Come back in the evening.';
    } else {
      level = 0.3;
      line = 'Midday lull. Some still feed; most wait it out.';
    }
    if (windy) {
      level *= 0.5;
      line += ' Wind has them low and hides their noise.';
    }
    return { level: clamp01(level), line };
  }

  if (species === 'turkey') {
    let level: number;
    let line: string;
    if (alt < -6) {
      level = 0.05;
      line = 'Dark. Birds are on the roost.';
    } else if (alt < -0.5 && morning) {
      level = 0.6;
      line = 'Gobbling on the limb, fly-down coming. Stay off the roost.';
    } else if (morning && alt < 40) {
      level = 0.95;
      line = 'Fly-down and strut. Birds work the open ground and edges.';
    } else if (!morning && alt < 25 && alt > -1) {
      level = 0.65;
      line = 'Afternoon feed, then back toward the roost.';
    } else if (!morning && alt <= -1) {
      level = 0.2;
      line = 'Birds are flying up to roost.';
    } else {
      level = 0.4;
      line = 'Midday. Birds loaf and dust. A lonely gobbler may still answer.';
    }
    if (windy) {
      level *= 0.6;
      line += ' Wind carries sound badly; birds drift to open or sheltered ground.';
    }
    return { level: clamp01(level), line };
  }
  return null;
}

export interface StripCell {
  date: Date;
  /** 0 settled, 1 rising, 2 sinking, 3 pooling (the model's codes). */
  state: number;
  strength: number;
  level: number;
}

/** One cell per slider hour at the hunter's spot (or the middle of the ground): the day at a glance. */
export function dayStrip(
  species: SpeciesId | null,
  conditions: { at(d: Date): HourConditions },
  grid: ElevationGrid,
  point: LngLat,
  hours: Date[],
): StripCell[] {
  const i = cellAt(grid, point);
  return hours.map((date) => {
    const hc = conditions.at(date);
    const state = i == null ? 0 : hc.thermal.state[i];
    const strength = i == null ? 0 : hc.thermal.strength[i];
    return { date, state, strength, level: activityFor(species, hc)?.level ?? 0 };
  });
}

/** Where the air changes direction next, e.g. "Thermals flip to sinking about 5 PM". Null when they don't. */
export function nextFlip(cells: StripCell[], from: number): string | null {
  const active = (c: StripCell) => (c.state === 1 || c.state === 2 || c.state === 3 ? c.state : 0);
  const now = active(cells[from]);
  for (let k = from + 1; k < cells.length; k++) {
    const a = active(cells[k]);
    if (a !== now && (a !== 0 || now !== 0)) {
      const t = cells[k].date.toLocaleTimeString('en-US', { hour: 'numeric' });
      const what = a === 0 ? 'settle' : `turn ${THERMAL_WORDS[a].toLowerCase()}`;
      return `Thermals ${what} about ${t}.`;
    }
  }
  return null;
}
