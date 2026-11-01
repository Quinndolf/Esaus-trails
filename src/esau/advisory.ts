import { angleDiff, bearingBetween, yardsBetween, type LngLat } from "../model/geo";
import type { Legal } from "../rules/types";

export interface Advisory {
  kind: "out_of_season" | "illegal" | "wrong_wind";
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
}

/** Scent is carried this many yards and this wide a cone; the same rule of thumb the sit-spot ranker uses. */
const SCENT_YD = 200;
const SCENT_CONE_DEG = 20;
/** Below this the wind is too light to carry scent in a line; thermals decide instead. */
const CALM_MPH = 2;

/**
 * The big banners. Only two things trigger one: out of season (or illegal) and wrong wind.
 * Private land, permission and nearness to a house or road never do.
 */
export function advisories(a: AdvisoryInput): Advisory[] {
  const out: Advisory[] = [];
  if (a.legal.status === "closed") out.push({ kind: "out_of_season", title: "Out of season", detail: a.legal.note });
  if (a.sit && a.wind.mph >= CALM_MPH) {
    const toward = (a.wind.fromDeg + 180) % 360;
    const hit = a.targets.find(
      (t) => yardsBetween(a.sit!.lngLat, t.lngLat) <= SCENT_YD && angleDiff(bearingBetween(a.sit!.lngLat, t.lngLat), toward) <= SCENT_CONE_DEG,
    );
    if (hit) {
      out.push({
        kind: "wrong_wind",
        title: "Wrong wind here",
        detail: "The wind will carry your scent right onto the trail. Sit somewhere the wind blows from the trail to you.",
      });
    }
  }
  return out;
}
