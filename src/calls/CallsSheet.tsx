import { useEffect, useRef, useState } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import type { SpeciesId } from '../esau/types';
import { CALLS, CALL_GROUP_TITLE, callsFor, type CallDef } from './catalog';
import { callPlayer } from './player';
import './calls.css';

/** One hold-to-play pad. Pointer capture keeps the sound going if the finger slides a little. */
function Pad({ call, recorded }: { call: CallDef; recorded: boolean }) {
  const [down, setDown] = useState(false);
  const pointer = useRef<number | null>(null);

  const stop = () => {
    pointer.current = null;
    setDown(false);
    callPlayer.release(call.id);
  };

  // Leaving the page or sheet while a finger is down must not leave a call running.
  useEffect(() => () => callPlayer.release(call.id), [call.id]);

  return (
    <div className="call-row">
      <button
        className={`call-pad ${down ? 'is-down' : ''}`}
        disabled={!recorded}
        aria-label={`${call.name}: press and hold`}
        data-testid={`call-${call.id}`}
        onPointerDown={(e) => {
          if (pointer.current != null) return;
          pointer.current = e.pointerId;
          e.currentTarget.setPointerCapture?.(e.pointerId);
          setDown(true);
          void callPlayer.press(call.id);
        }}
        onPointerUp={(e) => e.pointerId === pointer.current && stop()}
        onPointerCancel={(e) => e.pointerId === pointer.current && stop()}
        onLostPointerCapture={(e) => e.pointerId === pointer.current && stop()}
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
            setDown(true);
            void callPlayer.press(call.id);
          }
        }}
        onKeyUp={(e) => {
          if (e.key === ' ' || e.key === 'Enter') stop();
        }}
        onBlur={() => down && stop()}
      >
        <span className="call-name">{call.name}</span>
        <span className="call-hint">{!recorded ? 'No recording yet' : down ? 'Calling…' : 'Hold'}</span>
      </button>
      <p className="call-blurb">
        {call.blurb} {!recorded && <em className="call-missing">Real recording not added yet.</em>}
      </p>
    </div>
  );
}

/** Only the hunted animal's calls show. With no animal given (tests, tools) the whole board shows. */
export function CallsSheet({ open, onClose, species }: { open: boolean; onClose: () => void; species?: SpeciesId | null }) {
  const calls = species === undefined ? CALLS : callsFor(species);
  const groups = [...new Set(calls.map((c) => c.species))];
  const [sources, setSources] = useState<Record<string, 'recording' | 'missing'>>({});
  const [credits, setCredits] = useState<Awaited<ReturnType<typeof callPlayer.credits>>>([]);

  useEffect(() => {
    if (!open) {
      callPlayer.releaseAll();
      return;
    }
    void callPlayer.sources().then(setSources);
    void callPlayer.credits().then(setCredits);
    void callPlayer.warm();
  }, [open]);

  return (
    <BottomSheet title="Calls" open={open} onClose={onClose}>
      <p className="call-note">
        Press and hold. The sound plays as long as your finger is down. Turn the phone volume down before you walk in.
        Check your state's rules on calls before you use them to hunt.
      </p>
      {groups.map((g) => (
        <section key={g}>
          <h3 className="sheet-section">{CALL_GROUP_TITLE[g]}</h3>
          {calls.filter((c) => c.species === g).map((c) => (
            <Pad key={c.id} call={c} recorded={sources[c.id] === 'recording'} />
          ))}
        </section>
      ))}
      {credits.length > 0 && (
        <section>
          <h3 className="sheet-section">Recording credits</h3>
          <ul className="call-credits">
            {credits.filter((c) => calls.some((x) => x.id === c.id)).map((c) => (
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
