import { useEffect, useRef, useState } from 'react';
import { useEsau } from '../esau/ui/store';
import { callsFor, CALL_GROUP_TITLE } from './catalog';
import { callPlayer } from './player';
import './calls.css';

/** A press shorter than this is a tap (next call); longer is a hold (play). */
export const HOLD_MS = 250;

/**
 * One call button on the map for the animal being hunted. Tap steps to the next call, press and hold
 * plays it. A tap makes no sound, so cycling in the stand stays quiet. Only calls with a recording show.
 */
export function CallButton() {
  const species = useEsau((s) => s.species);
  const [recorded, setRecorded] = useState<Set<string> | null>(null);
  const [pick, setPick] = useState<Record<string, number>>({});
  const [playing, setPlaying] = useState(false);
  const pointer = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef<string | null>(null);

  useEffect(() => {
    void callPlayer.sources().then((s) => setRecorded(new Set(Object.keys(s).filter((id) => s[id] === 'recording'))));
  }, []);

  const calls = callsFor(species).filter((c) => recorded?.has(c.id));
  const key = species ?? '';
  const call = calls.length ? calls[(pick[key] ?? 0) % calls.length] : null;

  // Switching animal, or the button going away, must not leave a call running.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      if (held.current) callPlayer.release(held.current);
    },
    [key],
  );

  if (!call) return null;

  const down = () => {
    callPlayer.unlock();
    timer.current = setTimeout(() => {
      timer.current = null;
      held.current = call.id;
      setPlaying(true);
      void callPlayer.press(call.id);
    }, HOLD_MS);
  };
  /** `tap` is false when the press was cancelled (finger slid off, call interrupted): no step. */
  const up = (tap: boolean) => {
    pointer.current = null;
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
      if (tap && calls.length > 1) setPick((p) => ({ ...p, [key]: ((p[key] ?? 0) + 1) % calls.length }));
      return;
    }
    if (held.current) callPlayer.release(held.current);
    held.current = null;
    setPlaying(false);
  };

  const n = calls.indexOf(call) + 1;
  return (
    <button
      className={`fab labeled call-fab ${playing ? 'is-playing' : ''}`}
      data-testid="call-button"
      aria-label={`${CALL_GROUP_TITLE[call.species]} call: ${call.name}. Tap for the next call, hold to play.`}
      onPointerDown={(e) => {
        if (pointer.current != null) return;
        pointer.current = e.pointerId;
        e.currentTarget.setPointerCapture?.(e.pointerId);
        down();
      }}
      onPointerUp={(e) => e.pointerId === pointer.current && up(true)}
      onPointerCancel={(e) => e.pointerId === pointer.current && up(false)}
      onLostPointerCapture={(e) => e.pointerId === pointer.current && up(false)}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
          e.preventDefault();
          down();
        }
      }}
      onKeyUp={(e) => {
        if (e.key === ' ' || e.key === 'Enter') up(true);
      }}
    >
      <span className="call-fab-text">
        <span className="call-fab-name">{playing ? 'Calling…' : call.name}</span>
        <span className="call-fab-hint">
          {calls.length > 1 ? `${n}/${calls.length} · tap next · hold` : 'Hold to call'}
        </span>
      </span>
    </button>
  );
}
