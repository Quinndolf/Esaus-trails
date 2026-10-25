import { cardinal, compassWord } from './geo';
import { mixingWind, type ThermalField } from './thermal';
import { ScentDriver } from './scent';
import { ThermalState, type SunPosition, type WeatherHour } from './types';

/** Plain words for the readout and for Esau's context. Kept short, the way he talks. */

export const THERMAL_WORDS = ['Settled', 'Rising', 'Sinking', 'Pooling'] as const;

export function thermalLine(state: ThermalState, strength: number, weather: WeatherHour): string {
  if (state === ThermalState.Rising) {
    return strength > 0.55
      ? 'Sun is on this slope. Scent climbs, and fast.'
      : 'Sun is on this slope. Scent wants to climb.';
  }
  if (state === ThermalState.Sinking) {
    return strength > 0.55
      ? 'Cold air is sliding off this slope. Scent goes downhill.'
      : 'This slope is in shade. Air slides downhill.';
  }
  if (state === ThermalState.Pooling) return 'Low ground. Scent can pool here.';
  if (mixingWind(weather) >= 12) return 'Wind is strong enough to wash the thermals out.';
  return 'No strong thermal. Play the wind.';
}

export function windLine(w: WeatherHour): string {
  if (w.windMph < 1.5) return 'Calm. Thermals run the show.';
  const gust = w.gustMph && w.gustMph - w.windMph >= 5 ? `, gusting ${Math.round(w.gustMph)}` : '';
  return `Wind ${cardinal(w.windFrom)} ${Math.round(w.windMph)} mph${gust}. Scent goes ${compassWord(w.windFrom + 180)}.`;
}

/**
 * One line for the hour, weighted by where it matters. Pass bedding scores as
 * `weights` once the species model exists; until then every cell counts the same.
 */
export function hourSummary(
  thermal: ThermalField,
  weather: WeatherHour,
  sun: SunPosition,
  weights?: ArrayLike<number>,
): string {
  let up = 0;
  let down = 0;
  for (let i = 0; i < thermal.state.length; i++) {
    const w = (0.25 + (weights?.[i] ?? 0.5)) * thermal.strength[i];
    if (thermal.state[i] === ThermalState.Rising) up += w;
    else if (thermal.state[i] === ThermalState.Sinking || thermal.state[i] === ThermalState.Pooling) down += w;
  }
  if (mixingWind(weather) >= 12) return 'Wind owns this hour. Thermals take a back seat.';
  if (thermal.phase === 'morning' && down > up * 0.6 && up > 0)
    return 'Thermals are flipping. Hollows still drain, sunny faces start to climb.';
  if (thermal.phase === 'evening' && up > down * 0.6 && down > 0) return 'Evening flip. Shaded slopes start to drain.';
  if (up > down * 1.25 && sun.altitude > 6) return 'Upslope thermals. Scent climbs sunlit faces.';
  if (down > up * 1.15)
    return sun.altitude < 0
      ? 'After dark. Cold air settles into the lows.'
      : 'Air is draining. Valleys and shaded slopes hold scent.';
  return 'Settled air. Hunt the wind.';
}

export const DRIVER_WORDS: Record<ScentDriver, string> = {
  [ScentDriver.Wind]: 'wind',
  [ScentDriver.Thermal]: 'thermal',
  [ScentDriver.Swirl]: 'swirling',
};
