import { create } from 'zustand';
import type { SpeciesId } from '../esau/types';
import { useEsau } from '../esau/ui/store';

export type Weapon = 'bow' | 'crossbow' | 'rifle' | 'muzzleloader' | 'shotgun' | 'pellet';

export const WEAPON_NAME: Record<Weapon, string> = {
  bow: 'Bow',
  crossbow: 'Crossbow',
  rifle: 'Rifle',
  muzzleloader: 'Muzzleloader',
  shotgun: 'Shotgun',
  pellet: 'Pellet gun',
};

/** Deer, squirrel, ginseng, turkey first (Quinn's order), then the rest. */
export const ANIMAL_ORDER: SpeciesId[] = ['whitetail', 'squirrel', 'ginseng', 'turkey', 'mule_deer', 'elk', 'black_bear', 'hog'];

export const SHORT_NAME: Record<SpeciesId, string> = {
  whitetail: 'Whitetail',
  squirrel: 'Squirrel',
  ginseng: 'Ginseng',
  turkey: 'Turkey',
  mule_deer: 'Mule deer',
  elk: 'Elk',
  black_bear: 'Black bear',
  hog: 'Hog',
};

const DEER: Weapon[] = ['bow', 'crossbow', 'rifle', 'muzzleloader', 'shotgun'];

export function weaponsFor(species: SpeciesId | null): Weapon[] {
  if (!species || species === 'ginseng') return [];
  if (species === 'squirrel') return ['pellet', 'shotgun', 'rifle'];
  if (species === 'turkey') return ['shotgun', 'bow', 'crossbow'];
  return DEER;
}

const KEY = 'esau-weapon';

function saved(): Weapon | null {
  try {
    return (localStorage.getItem(KEY) as Weapon | null) ?? null;
  } catch {
    return null;
  }
}

function persist(w: Weapon | null) {
  try {
    if (w) localStorage.setItem(KEY, w);
    else localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

interface WeaponState {
  weapon: Weapon | null;
  setWeapon(w: Weapon | null): void;
  /** Keeps the weapon legal for the animal: an unfit one resets to the animal's first, ginseng clears it. */
  ensureFor(species: SpeciesId | null): void;
}

/**
 * The picker's weapon. Mirrors into `useEsau.weapon`, which Esau's brain and the legal read use.
 */
export const useWeapon = create<WeaponState>((set, get) => ({
  weapon: saved(),
  setWeapon(weapon) {
    persist(weapon);
    set({ weapon });
    // Esau's brain reads the weapon from its own store; keep them in step.
    if (useEsau.getState().weapon !== weapon) useEsau.getState().setWeapon(weapon);
  },
  ensureFor(species) {
    const ok = weaponsFor(species);
    const cur = get().weapon;
    const next = ok.length === 0 ? null : cur && ok.includes(cur) ? cur : ok[0];
    if (next !== cur) get().setWeapon(next);
  },
}));

export function chipLabel(species: SpeciesId | null, weapon: Weapon | null): string {
  if (!species) return 'What are you hunting?';
  return weapon ? `${SHORT_NAME[species]} · ${WEAPON_NAME[weapon]}` : SHORT_NAME[species];
}
