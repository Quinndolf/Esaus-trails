import { ThermalState } from '../model/types';

/** Above this wind the breeze, not the thermals, moves the air. */
export const WIND_OVERRIDE_MPH = 15;
const FADE_SPAN_MPH = 5;

/** 1 up to 15 mph, fading to 0 by 20 mph. */
export function windFade(mph: number): number {
  return Math.max(0, Math.min(1, 1 - (mph - WIND_OVERRIDE_MPH) / FADE_SPAN_MPH));
}

const RISING: [number, number, number] = [120, 200, 255]; // light blue
const SINKING: [number, number, number] = [150, 20, 30]; // dark red

/** RGBA for one cell: dark red where air pulls down, light blue where it rises, clear where settled. */
export function thermalRgba(state: ThermalState, strength: number, windMph: number): [number, number, number, number] {
  if (state === ThermalState.Settled) return [0, 0, 0, 0];
  const [r, g, b] = state === ThermalState.Rising ? RISING : SINKING;
  const a = Math.round((70 + 170 * Math.max(0, Math.min(1, strength))) * windFade(windMph));
  return [r, g, b, a];
}
