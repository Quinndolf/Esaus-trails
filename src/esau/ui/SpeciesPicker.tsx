import { SPECIES } from '../species';
import type { SpeciesId } from '../types';
import { useEsau } from './store';

const BLURB: Record<SpeciesId, string> = {
  whitetail: 'Beds, feeding and trails by the hour',
  mule_deer: 'Open country, big ground, long looks',
  elk: 'Herds, wallows and the bugle',
  black_bear: 'Food first, quiet travel',
  turkey: 'Roost, strut zone and fly-down',
  hog: 'Wallows, rooting and night feeding',
  squirrel: 'Nut trees, cuttings and first light',
  ginseng: 'Where sang likely grows. Not a hunt',
};

export const speciesName = (id: SpeciesId | null) => SPECIES.find((s) => s.id === id)?.name ?? '';

/**
 * Asked before Esau reads anything: what are you after? Everything else in the app (Esau's reads,
 * the overlays, the calls and the tools) follows the answer.
 */
export function SpeciesPicker() {
  const species = useEsau((s) => s.species);
  const choosing = useEsau((s) => s.choosing);
  const setSpecies = useEsau((s) => s.setSpecies);
  const setChoosing = useEsau((s) => s.setChoosing);
  if (species && !choosing) return null;

  return (
    <div className="picker-scrim" role="dialog" aria-modal="true" aria-label="What are you hunting?" data-testid="species-picker">
      <div className="picker">
        <h2>{species ? 'Change your hunt' : 'What are you after?'}</h2>
        <p className="picker-lede">
          Pick one. Esau will read the ground for that animal only, and the map, calls and tools will follow.
        </p>
        <div className="picker-grid" role="radiogroup" aria-label="Animal">
          {SPECIES.filter((s) => s.ready).map((sp) => (
            <button
              key={sp.id}
              role="radio"
              aria-checked={species === sp.id}
              className={`picker-card ${species === sp.id ? 'is-active' : ''}`}
              data-testid={`pick-${sp.id}`}
              onClick={() => setSpecies(sp.id)}
            >
              <strong>{sp.name}</strong>
              <span>{BLURB[sp.id]}</span>
            </button>
          ))}
        </div>
        {species && (
          <button className="link-btn picker-cancel" onClick={() => setChoosing(false)}>
            Keep hunting {speciesName(species).toLowerCase()}
          </button>
        )}
      </div>
    </div>
  );
}

/** Top-of-screen reminder of what the app is scoped to; tap to change. */
export function HuntPill() {
  const species = useEsau((s) => s.species);
  const setChoosing = useEsau((s) => s.setChoosing);
  if (!species || species === 'ginseng') return null;
  return (
    <button className="hunt-pill" data-testid="hunt-pill" onClick={() => setChoosing(true)} aria-label={`Hunting ${speciesName(species)}. Change`}>
      Hunting <strong>{speciesName(species)}</strong> <span aria-hidden>▾</span>
    </button>
  );
}
