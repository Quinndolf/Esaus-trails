import type { Legal, Weapon } from "../rules/types";
import type { SpeciesId } from "./types";

export interface SafetyInput {
  species: SpeciesId;
  weapon: Weapon | null;
  legal: Legal;
  sunPhase: string;
  /** 0 to 100, or null when the phone can't say (iOS Safari has no Battery API). */
  batteryPct: number | null;
  saddle: boolean;
  /** Keys already given on this hunt. Each line is said once. */
  alreadyShown: Set<string>;
}

const FIREARMS: Weapon[] = ["rifle", "shotgun", "muzzleloader"];

/** Short, once-per-hunt reminders. Not a lecture. */
export function safetyLines(a: SafetyInput): { lines: string[]; shown: string[] } {
  const want: [string, string][] = [];
  const gunSeason = a.legal.status === "open" && a.weapon != null && FIREARMS.includes(a.weapon) && a.species !== "squirrel";
  if (gunSeason) want.push(["orange", "Gun season: wear solid blaze orange on your head, back and chest."]);
  if (["dawn", "dusk", "night"].includes(a.sunPhase)) want.push(["light", "Low light: have a flashlight handy for the walk."]);
  if (a.batteryPct != null && a.batteryPct < 50) want.push(["battery", `Phone is at ${Math.round(a.batteryPct)}%. Charge it or carry a battery pack.`]);
  if (a.saddle) want.push(["saddle", "Saddle hunting: stay connected on a lineman's rope from the ground up."]);
  const fresh = want.filter(([k]) => !a.alreadyShown.has(k));
  return { lines: fresh.map(([, t]) => t), shown: fresh.map(([k]) => k) };
}
