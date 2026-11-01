import { beforeEach, describe, expect, it } from 'vitest';
import { ANIMAL_ORDER, chipLabel, useWeapon, weaponsFor } from '../weapon';

describe('animals and weapons', () => {
  beforeEach(() => useWeapon.setState({ weapon: null }));

  it('lists deer, squirrel, ginseng, turkey first, then the rest', () => {
    expect(ANIMAL_ORDER.slice(0, 4)).toEqual(['whitetail', 'squirrel', 'ginseng', 'turkey']);
    expect(new Set(ANIMAL_ORDER).size).toBe(ANIMAL_ORDER.length);
  });

  it('offers weapons by animal; ginseng has none', () => {
    expect(weaponsFor('whitetail').slice(0, 2)).toEqual(['bow', 'crossbow']);
    expect(weaponsFor('squirrel')[0]).toBe('pellet');
    expect(weaponsFor('ginseng')).toEqual([]);
  });

  it('resets an invalid weapon to the animal first choice', () => {
    useWeapon.getState().setWeapon('pellet');
    useWeapon.getState().ensureFor('whitetail');
    expect(useWeapon.getState().weapon).toBe('bow');
    useWeapon.getState().setWeapon('crossbow');
    useWeapon.getState().ensureFor('whitetail');
    expect(useWeapon.getState().weapon).toBe('crossbow');
    useWeapon.getState().ensureFor('ginseng');
    expect(useWeapon.getState().weapon).toBeNull();
  });

  it('labels the chip', () => {
    expect(chipLabel('whitetail', 'crossbow')).toBe('Whitetail · Crossbow');
    expect(chipLabel('ginseng', null)).toBe('Ginseng');
    expect(chipLabel(null, null)).toBe('What are you hunting?');
  });
});
