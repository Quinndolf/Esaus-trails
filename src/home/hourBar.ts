import { cardinal } from '../map/geo';
import type { StripCell } from '../hour/scope';

export interface BarSegment {
  from: number;
  to: number;
  state: number;
}

/** Runs of equal thermal state as fractions (0-1) of the bar's width. */
export function barSegments(cells: StripCell[]): BarSegment[] {
  const out: BarSegment[] = [];
  const n = cells.length;
  cells.forEach((c, i) => {
    const last = out[out.length - 1];
    if (last && last.state === c.state) last.to = (i + 1) / n;
    else out.push({ from: i / n, to: (i + 1) / n, state: c.state });
  });
  return out;
}

const LEGAL_MARGIN_MS = 30 * 60e3;

/** Sunrise, sunset and legal shooting light (30 min before sunrise to 30 min after sunset) as 0-1 positions. */
export function lightMarks(hours: Date[], sunrise: Date, sunset: Date) {
  const t0 = hours[0].getTime();
  const span = hours[hours.length - 1].getTime() - t0 || 1;
  const at = (ms: number) => Math.max(0, Math.min(1, (ms - t0) / span));
  return {
    sunrise: at(sunrise.getTime()),
    sunset: at(sunset.getTime()),
    legalStart: at(sunrise.getTime() - LEGAL_MARGIN_MS),
    legalEnd: at(sunset.getTime() + LEGAL_MARGIN_MS),
  };
}

export function readoutLine(r: { stateWord: string; windMph: number; windFrom: number; tempF: number }): string {
  return `${r.stateWord} · ${cardinal(r.windFrom)} ${Math.round(r.windMph)} mph · ${Math.round(r.tempF)}°`;
}
