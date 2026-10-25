import { useEffect, useRef, useState } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { CALLS, type CallDef, type CallSpecies } from './catalog';
import { callPlayer } from './player';
import './calls.css';

const GROUPS: { species: CallSpecies; title: string }[] = [
  { species: 'deer', title: 'Deer' },
  { species: 'squirrel', title: 'Squirrel' },
  { species: 'turkey', title: 'Turkey' },
];

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

export function CallsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
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
      {GROUPS.map((g) => (
        <section key={g.species}>
          <h3 className="sheet-section">{g.title}</h3>
          {CALLS.filter((c) => c.species === g.species).map((c) => (
            <Pad key={c.id} call={c} recorded={sources[c.id] === 'recording'} />
          ))}
        </section>
      ))}
      {credits.length > 0 && (
        <section>
          <h3 className="sheet-section">Recording credits</h3>
          <ul className="call-credits">
            {credits.map((c) => (
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
