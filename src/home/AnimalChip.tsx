import { useEffect, useRef, useState } from 'react';
import { useEsau } from '../esau/ui/store';
import { ANIMAL_ORDER, SHORT_NAME, WEAPON_NAME, chipLabel, useWeapon, weaponsFor } from './weapon';
import type { SpeciesId } from '../esau/types';
import { SETUPS, type Setup } from '../model/sitSpots';
import './home.css';

/**
 * Top-left chip: the animal and weapon. Tap for a vertical list of animals, then (when the animal
 * uses one) the weapon question. Replaces the full-screen picker.
 */
export function AnimalChip() {
  const species = useEsau((s) => s.species);
  const setSpecies = useEsau((s) => s.setSpecies);
  const weapon = useWeapon((s) => s.weapon);
  const [step, setStep] = useState<'closed' | 'animal' | 'weapon'>('closed');
  const setup = useEsau((s) => s.setup);
  /** Whether a weapon was tapped on this pass through the card (the list starts on a default). */
  const weaponTapped = useRef(false);
  const [pending, setPending] = useState<SpeciesId | null>(null);

  const wrap = useRef<HTMLDivElement>(null);
  // Tapping anywhere else (Tools, a sheet, the map) puts the list away.
  useEffect(() => {
    if (step === 'closed') return;
    const away = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) {
        setStep('closed');
        setPending(null);
      }
    };
    document.addEventListener('pointerdown', away, true);
    return () => document.removeEventListener('pointerdown', away, true);
  }, [step]);

  const close = () => {
    setStep('closed');
    setPending(null);
  };

  const pickAnimal = (id: SpeciesId) => {
    const ws = weaponsFor(id);
    setSpecies(id);
    useWeapon.getState().ensureFor(id);
    if (ws.length === 0) return close();
    setPending(id);
    weaponTapped.current = false;
    setStep('weapon');
  };

  return (
    <div className="animal-chip-wrap" ref={wrap}>
      <button
        className="chip"
        data-testid="animal-chip"
        aria-expanded={step !== 'closed'}
        aria-label={`Hunting: ${chipLabel(species, weapon)}${species !== 'ginseng' && weapon && setup ? `, ${SETUP_NAME[setup]}` : ''}. Change`}
        onClick={() => (step === 'closed' ? setStep('animal') : close())}
      >
        {chipLabel(species, species === 'ginseng' ? null : weapon)}
        {species !== 'ginseng' && weapon && setup ? ` · ${SETUP_NAME[setup]}` : ''} <span aria-hidden>⌃</span>
      </button>

      {step === 'animal' && (
        <div className="chip-list" role="listbox" aria-label="Animal">
          {ANIMAL_ORDER.map((id) => (
            <button
              key={id}
              role="option"
              aria-selected={species === id}
              className={`chip-item ${species === id ? 'is-active' : ''}`}
              data-testid={`animal-${id}`}
              onClick={() => pickAnimal(id)}
            >
              {SHORT_NAME[id]}
            </button>
          ))}
        </div>
      )}

      {step === 'weapon' && pending && (
        <div className="chip-list" role="group" aria-label="Weapon">
          <p className="chip-q">What are you hunting with?</p>
          {weaponsFor(pending).map((w) => (
            <button
              key={w}
              className={`chip-item ${weapon === w ? 'is-active' : ''}`}
              data-testid={`weapon-${w}`}
              onClick={() => {
                useWeapon.getState().setWeapon(w);
                weaponTapped.current = true;
                // Done once both are answered; a saved setup counts.
                if (useEsau.getState().setup) close();
              }}
            >
              {WEAPON_NAME[w]}
            </button>
          ))}
          <p className="chip-q">How are you set up?</p>
          <div className="chip-row" role="group" aria-label="Setup">
            {SETUPS.map((k) => (
              <button
                key={k}
                className={`chip-item ${setup === k ? 'is-active' : ''}`}
                data-testid={`setup-${k}`}
                onClick={() => {
                  useEsau.getState().setSetup(k);
                  // Done once both are answered on this card.
                  if (weaponTapped.current) close();
                }}
              >
                {SETUP_NAME[k]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export const SETUP_NAME: Record<Setup, string> = { ground: 'Ground', tree_stand: 'Tree stand', saddle: 'Saddle' };
