import type { Map as MLMap } from 'maplibre-gl';
import { cardinal, type LngLat } from '../map/geo';
import { CloseIcon } from '../ui/icons';
import { bboxAround } from './ground';
import { useHour } from './store';
import { useHourOverlays } from './useHourOverlays';
import './hour.css';

const ClockIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
  >
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

function hourLabel(d: Date, first: boolean) {
  const t = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return first ? `Now · ${t}` : `${d.toLocaleDateString('en-US', { weekday: 'short' })} ${t}`;
}

function readHere(map: MLMap | null) {
  if (!map) return;
  const c = map.getCenter();
  void useHour.getState().load(bboxAround([c.lng, c.lat]));
}

/** Button for the left control stack: opens the hour slider, reading the ground on first use. */
export function HourButton({ map }: { map: MLMap | null }) {
  const { open, status, setOpen } = useHour();
  return (
    <button
      className={`fab labeled ${open ? 'is-on' : ''}`}
      aria-label="Hour slider"
      aria-pressed={open}
      onClick={() => {
        if (open) setOpen(false);
        else if (status === 'idle' || status === 'error') readHere(map);
        else setOpen(true);
      }}
    >
      <ClockIcon />
      <span>Hours</span>
    </button>
  );
}

/**
 * The hour slider: scrub through the next 24 hours and watch thermals, wind, the
 * hunter's scent and probable deer movement shift across the ground.
 */
export function HourPanel({ map, hunter }: { map: MLMap | null; hunter: LngLat | null }) {
  const { open, status, error, hours, date, setDate, setOpen, grid } = useHour();
  const frame = useHourOverlays(map, hunter);
  if (!open) return null;

  const k = Math.max(
    0,
    hours.findIndex((h) => h.getTime() === date.getTime()),
  );
  const w = frame?.hc.weather;

  return (
    <div className="hour-panel" role="region" aria-label="Hour slider" data-testid="hour-panel">
      <div className="hour-head">
        <strong data-testid="hour-label">{hours.length ? hourLabel(date, k === 0) : 'Hour by hour'}</strong>
        {w && (
          <span className="hour-wx" data-testid="hour-wind">
            <span className="wind-glyph" style={{ transform: `rotate(${w.windFrom + 180}deg)` }} aria-hidden>
              ↑
            </span>
            {Math.round(w.windMph)} mph {cardinal(w.windFrom)} · {Math.round(w.tempF)}°
          </span>
        )}
        <button className="icon-btn" aria-label="Close hour slider" onClick={() => setOpen(false)}>
          <CloseIcon />
        </button>
      </div>

      {status === 'loading' && <p className="hour-msg">Reading the ground and the weather…</p>}
      {status === 'error' && (
        <p className="hour-msg warn">
          {error}{' '}
          <button className="link-btn" onClick={() => readHere(map)}>
            Try again
          </button>
        </p>
      )}

      {status === 'ready' && frame && (
        <>
          <input
            className="hour-slider"
            type="range"
            min={0}
            max={hours.length - 1}
            step={1}
            value={k}
            aria-label="Hour"
            aria-valuetext={hourLabel(date, k === 0)}
            onChange={(e) => setDate(hours[Number(e.target.value)])}
          />
          <p className="hour-line" data-testid="hour-summary">
            {frame.hc.summary}
          </p>
          <p className="hour-line" data-testid="hour-movement">
            {frame.m.line}
          </p>
          <p className="hour-line" data-testid="hour-atmosphere">
            {frame.hc.atmosphere.line}
          </p>
          <div className="hour-legend">
            <span>
              <i className="sw rise" />
              Rising
            </span>
            <span>
              <i className="sw sink" />
              Sinking
            </span>
            <span>
              <i className="sw deer" />
              Deer likely
            </span>
            <span>
              <i className="sw trail" />
              Trail
            </span>
            <span>
              <i className="sw scent" />
              Your scent
            </span>
            <button className="link-btn" onClick={() => readHere(map)}>
              Read here
            </button>
          </div>
          {frame.hc.weather.extrapolated && (
            <p className="hour-msg">Past the end of the forecast; holding the last hour.</p>
          )}
          {grid?.notes?.length ? <p className="hour-msg">{grid.notes.join(' ')}</p> : null}
        </>
      )}
    </div>
  );
}
