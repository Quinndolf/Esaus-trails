import { angleDiff, bearingBetween, compassWord, yardsBetween, type LngLat } from "../model/geo";
import type { Legal } from "../rules/types";

export interface Advisory {
  kind: "out_of_season" | "illegal" | "wrong_wind" | "wind_shift";
  title: string;
  detail: string;
}

export interface AdvisoryInput {
  legal: Legal;
  /** Wind speed and the direction it blows FROM, at the hour on the slider. */
  wind: { mph: number; fromDeg: number };
  /** Where the hunter plans to sit. Null until they pick one. */
  sit: { lngLat: LngLat } | null;
  /** Predicted trails and beds near the sit spot. */
  targets: { lngLat: LngLat }[];
  /** The forecast wind at the sit spot for the next few hours, soonest first, to warn before it turns. */
  later?: { hoursAhead: number; wind: { mph: number; fromDeg: number } }[];
}

interface Wind {
  mph: number;
  fromDeg: number;
}

/** True when this wind carries scent from the sit spot onto a trail or bed. */
function scentOnTarget(sit: LngLat, wind: Wind, targets: { lngLat: LngLat }[]): boolean {
  if (wind.mph < CALM_MPH) return false;
  const toward = (wind.fromDeg + 180) % 360;
  return targets.some((t) => yardsBetween(sit, t.lngLat) <= SCENT_YD && angleDiff(bearingBetween(sit, t.lngLat), toward) <= SCENT_CONE_DEG);
}

/** Scent is carried this many yards and this wide a cone; the same rule of thumb the sit-spot ranker uses. */
const SCENT_YD = 200;
const SCENT_CONE_DEG = 20;
/** Below this the wind is too light to carry scent in a line; thermals decide instead. */
const CALM_MPH = 2;

/**
 * The big banners. Only these trigger one: out of season (or illegal), wrong wind, and wind about to turn wrong.
 * Private land, permission and nearness to a house or road never do.
 */
export function advisories(a: AdvisoryInput): Advisory[] {
  const out: Advisory[] = [];
  if (a.legal.status === "closed") out.push({ kind: "out_of_season", title: "Out of season", detail: a.legal.note });
  if (a.sit && scentOnTarget(a.sit.lngLat, a.wind, a.targets)) {
    out.push({
      kind: "wrong_wind",
      title: "Wrong wind here",
      detail: "The wind will carry your scent right onto the trail. Sit somewhere the wind blows from the trail to you.",
    });
  } else if (a.sit) {
    // Good wind now: warn if the forecast turns it onto the trail while you sit.
    const turn = a.later?.find((l) => scentOnTarget(a.sit!.lngLat, l.wind, a.targets));
    if (turn) {
      const when = turn.hoursAhead === 1 ? "an hour" : `${turn.hoursAhead} hours`;
      out.push({
        kind: "wind_shift",
        title: `Wind turns in about ${when}`,
        detail: `The forecast has the wind coming from the ${compassWord(turn.wind.fromDeg)} by then, which carries your scent onto the trail. Plan to leave or move before it turns.`,
      });
    }
  }
  return out;
}
