import { WEAPON_NAME, type Weapon } from './weapon';

/** Rule-of-thumb working ranges for a beginner, in yards. Squirrel with the pellet gun is 40 (Quinn). */
export const WORKING_RANGE_YD: Record<Weapon, number> = { bow: 30, crossbow: 40, pellet: 40, shotgun: 40, muzzleloader: 150, rifle: 200 };

export function rangeNote(weapon: Weapon | null, yards: number): string {
  const y = Math.round(yards);
  if (!weapon) return `${y} yd`;
  const name = WEAPON_NAME[weapon].toLowerCase();
  return y <= WORKING_RANGE_YD[weapon] ? `${y} yd · within ${name} range` : `${y} yd · beyond ${name} range (about ${WORKING_RANGE_YD[weapon]} yd)`;
}
