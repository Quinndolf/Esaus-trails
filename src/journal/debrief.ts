import type { SpeciesId } from "../esau/types";
import type { Weapon } from "../model/sitSpots";
import type { Analysis, Crossing } from "./analyze";

/** Plain, short lines in Esau's voice. Built from the hunter's own track on the phone; nothing leaves it. */
export function debriefLines(a: Analysis, ctx: { species: SpeciesId; weapon: Weapon | null }, crossings: Crossing[]): string[] {
  const lines = [`You covered ${Math.round(a.distanceYd).toLocaleString()} yd in ${Math.round(a.durationMin)} minutes.`];
  const longest = [...a.sits].sort((x, y) => y.minutes - x.minutes)[0];
  if (longest) lines.push(`Your longest sit was ${Math.round(longest.minutes)} minutes. Good..`);
  else if (a.durationMin > 30) lines.push("You never sat more than a few minutes. Next time pick a spot and give it half an hour.");
  if (crossings.length === 0) lines.push("Clean walk. Your scent never drifted onto a bed or trail we know about.");
  for (const c of crossings) {
    lines.push(`Wind put your scent on a ${c.what} ${c.yards} yd away. Come in from the other side next time so your scent stays off it.`);
  }
  return lines;
}
