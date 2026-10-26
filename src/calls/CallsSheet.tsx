import { useEffect, useState } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import type { SpeciesId } from '../esau/types';
import { CALLS, CALL_GROUP_TITLE, callsFor } from './catalog';
import { callPlayer } from './player';
import './calls.css';

/**
 * How the call button works, what each call is, and the recording credits. Calls are played from the
 * call button on the map, not from here. With no animal given (tests) every call is listed.
 */
export function CallsSheet({ open, onClose, species }: { open: boolean; onClose: () => void; species?: SpeciesId | null }) {
  const calls = species === undefined ? CALLS : callsFor(species);
  const groups = [...new Set(calls.map((c) => c.species))];
  const [sources, setSources] = useState<Record<string, 'recording' | 'missing'>>({});
  const [credits, setCredits] = useState<Awaited<ReturnType<typeof callPlayer.credits>>>([]);

  useEffect(() => {
    if (!open) return;
    void callPlayer.sources().then(setSources);
    void callPlayer.credits().then(setCredits);
  }, [open]);

  return (
    <BottomSheet title="Calls" open={open} onClose={onClose}>
      <p className="call-note">
        Use the call button on the map. Tap it to step to the next call, press and hold to play it. A tap makes no
        sound. The calls follow the animal you picked. Turn the phone volume down before you walk in, and check your
        state's rules on calls before you use them to hunt.
      </p>
      {groups.map((g) => (
        <section key={g}>
          <h3 className="sheet-section">{CALL_GROUP_TITLE[g]}</h3>
          {calls
            .filter((c) => c.species === g)
            .map((c) => (
              <div className="call-row" key={c.id} data-testid={`call-info-${c.id}`}>
                <span className="call-name">{c.name}</span>
                <p className="call-blurb">
                  {c.blurb} {sources[c.id] === 'missing' && <em className="call-missing">No recording yet.</em>}
                </p>
              </div>
            ))}
        </section>
      ))}
      {credits.length > 0 && (
        <section>
          <h3 className="sheet-section">Recording credits</h3>
          <ul className="call-credits">
            {credits
              .filter((c) => calls.some((x) => x.id === c.id))
              .map((c) => (
                <li key={c.id}>
                  {CALLS.find((x) => x.id === c.id)?.name ?? c.id}: {c.author}, {c.license}.{' '}
                  <a href={c.source} target="_blank" rel="noreferrer">
                    Source
                  </a>
                </li>
              ))}
          </ul>
        </section>
      )}
    </BottomSheet>
  );
}
