import { bearingBetween, cardinal, yardsBetween, type LngLat } from '../../model/geo';
import type { Analysis } from '../analyze';
import { useEsau } from './store';

type Verdict = NonNullable<Analysis['verdict']>;

const away = (from: LngLat, to: LngLat) => `${Math.round(yardsBetween(from, to) / 5) * 5} yd ${cardinal(bearingBetween(from, to))}`;

const ROUND = (yd: number) => Math.round(yd / 10) * 10;

/** The plain words on the card: the call, a score out of 100, why, and where to go instead. */
export function verdictWords(v: Verdict): { call: string; score: string; detail: string; better: string[] } {
  const here = v.of === 'hunter' ? 'Where you stand' : 'This spot';
  const score = `Score ${v.pct} / 100`;
  if (v.stay)
    return {
      call: 'Stay here',
      score,
      detail: v.pct >= 95 ? `${here} is the best spot Esau found on your screen.` : `${here} is close to the best spot Esau found (that one scores 100). Sit tight.`,
      better: [],
    };
  const why: Record<NonNullable<Verdict['why']>, string> = {
    out_of_range: `No predicted deer trail within ${v.rangeYd} yd, your weapon's range${v.trailYd != null ? `. The nearest is about ${ROUND(v.trailYd)} yd away` : ''}.`,
    bed_downwind: 'The wind would carry your scent right into where deer bed.',
    scent_on_trail: 'The wind carries your scent onto the trail, so deer would smell you before they are in range.',
    near_bed: 'You are very close to where deer bed. They would likely see or hear you.',
    on_axis: 'Deer would walk straight at you here and see you first.',
  };
  const reason = v.why ? why[v.why] : 'Fewer deer are predicted to pass in range here than at the spots below.';
  const better = v.better.map((b) => `#${b.rank}: ${away(v.at, b.lngLat)}`);
  const go = v.offScreen
    ? ` A better spot is ${away(v.at, v.offScreen.lngLat)}, just off the screen.`
    : better.length
      ? ' Try one of these numbered spots:'
      : '';
  return { call: 'Move', score, detail: `${here}: ${reason.charAt(0).toLowerCase()}${reason.slice(1)}${go}`, better };
}

/** Stay or move, in big plain words, at the top of Esau's panel. */
export function VerdictCard({ verdict }: { verdict: Verdict }) {
  const w = verdictWords(verdict);
  return (
    <div className={`esau-verdict ${verdict.stay ? 'is-stay' : 'is-move'}`} data-testid="verdict">
      <div className="esau-verdict-head">
        <strong>{w.call}</strong>
        <span className="esau-verdict-score">{w.score}</span>
      </div>
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
