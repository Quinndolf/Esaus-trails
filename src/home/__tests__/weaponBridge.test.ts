// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { useEsau } from '../../esau/ui/store';
import { useWeapon } from '../weapon';

describe('weapon picker and Esau', () => {
  it('passes the picked weapon to the Esau store, which the legal read uses', () => {
    useWeapon.getState().setWeapon('crossbow');
    expect(useEsau.getState().weapon).toBe('crossbow');
    useWeapon.getState().setWeapon('pellet');
    expect(useEsau.getState().weapon).toBe('pellet');
  });
});
