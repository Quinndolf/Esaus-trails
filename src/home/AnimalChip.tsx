import { useState } from 'react';
import { useEsau } from '../esau/ui/store';
import { ANIMAL_ORDER, SHORT_NAME, WEAPON_NAME, chipLabel, useWeapon, weaponsFor } from './weapon';
import type { SpeciesId } from '../esau/types';
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
  const [pending, setPending] = useState<SpeciesId | null>(null);

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
    setStep('weapon');
  };

  return (
    <div className="animal-chip-wrap">
      <button
        className="chip"
        data-testid="animal-chip"
        aria-expanded={step !== 'closed'}
        aria-label={`Hunting: ${chipLabel(species, weapon)}. Change`}
        onClick={() => (step === 'closed' ? setStep('animal') : close())}
      >
        {chipLabel(species, species === 'ginseng' ? null : weapon)} <span aria-hidden>⌃</span>
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
                close();
              }}
            >
              {WEAPON_NAME[w]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
