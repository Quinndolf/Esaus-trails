import { useMemo } from 'react';
import type { Map as MLMap } from 'maplibre-gl';
import type { LngLat } from '../map/geo';
import { THERMAL_WORDS } from '../model/describe';
import { useEsau } from '../esau/ui/store';
import { viewGround } from '../hour/view';
import { dayStrip, hourScope } from '../hour/scope';
import { ageLabel } from '../hour/groundCache';
import { useHour } from '../hour/store';
import { useHourOverlays } from '../hour/useHourOverlays';
import { barSegments, lightMarks, readoutLine } from './hourBar';
import { WIND_OVERRIDE_MPH } from './shade';
import './home.css';

const TINT: Record<number, string> = {
  0: 'transparent',
  1: 'rgba(150, 20, 30, 0.55)', // rising: dark red (warm)
  2: 'rgba(120, 200, 255, 0.65)', // sinking: light blue (cold)
  3: 'rgba(120, 200, 255, 0.65)', // pooling: light blue (cold)
};

function clock(d: Date, first: boolean) {
  const t = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return first ? `Now · ${t}` : t;
}

/**
 * The hour slider, always on the home map once an animal is chosen: a slim see-through bar at the very
 * bottom, tinted by thermal state across the day, marking sunrise, sunset and legal light.
 */
export function HourBar({ map, hunter, facing = null }: { map: MLMap | null; hunter: LngLat | null; facing?: number | null }) {
  const { status, error, hours, date, setDate, grid, conditions, staleSince, showThermals, setShowThermals } = useHour();
  const species = useEsau((s) => s.species);
  const scope = hourScope(species);
  const frame = useHourOverlays(map, hunter, facing);
  const spot: LngLat | null = hunter ?? (grid ? [(grid.west + grid.east) / 2, (grid.south + grid.north) / 2] : null);
  const cells = useMemo(
    () => (scope && grid && conditions && spot && hours.length ? dayStrip(species, conditions, grid, spot, hours) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scope?.strip, species, grid, conditions, hours, spot?.[0], spot?.[1]],
  );
  const segs = useMemo(() => (scope?.thermals ? barSegments(cells) : []), [scope?.thermals, cells]);
  const marks = useMemo(() => {
    if (!conditions || hours.length < 2) return null;
    const t = conditions.at(hours[0]).sunTimes;
    return t.sunrise && t.sunset ? lightMarks(hours, t.sunrise, t.sunset) : null;
  }, [conditions, hours]);

  if (!scope) return null;
  const k = Math.max(0, hours.findIndex((h) => h.getTime() === date.getTime()));
  const w = frame?.hc.weather;
  const word = scope.thermals && cells[k] ? THERMAL_WORDS[cells[k].state] : null;
  const windRules = !!w && w.windMph > WIND_OVERRIDE_MPH;

  let line: string;
  if (status === 'loading' || status === 'idle') line = 'Reading the ground and the weather…';
  else if (status === 'error') line = error ?? "Couldn't read the ground.";
  else if (w) line = readoutLine({ stateWord: windRules ? 'Wind rules' : (word ?? 'Light'), windMph: w.windMph, windFrom: w.windFrom, tempF: w.tempF });
  else line = '';
  if (status === 'ready' && staleSince) line = `Saved weather from ${ageLabel(staleSince)} · ${line}`;

  return (
    <div className="hour-bar" role="region" aria-label="Hour slider" data-testid="hour-bar">
      <div className="hour-bar-head">
        <strong data-testid="hour-label">{status === 'ready' && hours.length ? clock(date, k === 0) : 'Hour by hour'}</strong>
        <span data-testid="hour-readout">{line}</span>
        {scope.thermals && status === 'ready' && (
          <button
            className={`thermal-toggle ${showThermals ? 'is-on' : ''}`}
            data-testid="thermal-toggle"
            aria-pressed={showThermals}
            onClick={() => setShowThermals(!showThermals)}
          >
            Thermals {showThermals ? 'on' : 'off'}
          </button>
        )}
        {status === 'error' && grid == null && (
          <button
            className="link-btn"
            onClick={() => {
              if (!map) return;
              void useHour.getState().load(viewGround(map));
            }}
          >
            Try again
          </button>
        )}
      </div>
      {status === 'ready' && hours.length > 0 && (
        <div className="hour-bar-track">
          {segs.map((s) => (
            <i key={s.from} className="seg" style={{ left: `${s.from * 100}%`, width: `${(s.to - s.from) * 100}%`, background: TINT[s.state] }} />
          ))}
          {marks && (
            <>
              <i className="legal" style={{ left: `${marks.legalStart * 100}%`, width: `${(marks.legalEnd - marks.legalStart) * 100}%` }} />
              <i className="mark sun" title="Sunrise" style={{ left: `${marks.sunrise * 100}%` }} />
              <i className="mark sun" title="Sunset" style={{ left: `${marks.sunset * 100}%` }} />
            </>
          )}
          <input
            className="hour-bar-slider"
            type="range"
            min={0}
            max={hours.length - 1}
            step={1}
            value={k}
            aria-label="Hour"
            aria-valuetext={clock(date, k === 0)}
            onChange={(e) => setDate(hours[Number(e.target.value)])}
          />
        </div>
      )}
    </div>
  );
}
