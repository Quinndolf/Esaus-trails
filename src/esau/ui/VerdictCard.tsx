import { bearingBetween, cardinal, yardsBetween, type LngLat } from '../../model/geo';
import type { Analysis } from '../analyze';
import { useEsau } from './store';

type Verdict = NonNullable<Analysis['verdict']>;

const away = (from: LngLat, to: LngLat) => `${Math.round(yardsBetween(from, to) / 5) * 5} yd ${cardinal(bearingBetween(from, to))}`;

/** The plain words on the card: one line for the call, one for what to do about it. */
export function verdictWords(v: Verdict): { call: string; detail: string; better: string[] } {
  const where = v.of === 'hunter' ? 'Where you stand' : 'This spot';
  const better = v.better.map((b) => `#${b.rank}: ${away(v.at, b.lngLat)}`);
  if (v.stay)
    return { call: `Stay · ${v.pct}%`, detail: `${where} is ${v.pct}% as good as the best sit Esau found. Sit tight.`, better: [] };
  return {
    call: `Move · ${v.pct}%`,
    detail: v.offScreen
      ? `${where} is only ${v.pct}% as good. The best sit is ${away(v.at, v.offScreen.lngLat)}, just off the screen.`
      : better.length
        ? `${where} is only ${v.pct}% as good as the numbered spots. Try one of these:`
        : `${where} is only ${v.pct}% as good as the best sit Esau found.`,
    better,
  };
}

/** Stay or move, in big plain words, at the top of Esau's panel. */
export function VerdictCard({ verdict }: { verdict: Verdict }) {
  const w = verdictWords(verdict);
  return (
    <div className={`esau-verdict ${verdict.stay ? 'is-stay' : 'is-move'}`} data-testid="verdict">
      <strong>{w.call}</strong>
      <span>{w.detail}</span>
      {w.better.length > 0 && (
        <ul>
          {w.better.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      )}
      {verdict.offScreen && (
        <button className="link-btn" data-testid="verdict-show" onClick={() => useEsau.setState({ showSpot: verdict.offScreen!.lngLat })}>
          Zoom out to it
        </button>
      )}
    </div>
  );
}
