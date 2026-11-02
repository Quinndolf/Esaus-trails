import type { EsauBrief } from "./brief";
import { CLASS_WORDS, ginsengClass, ginsengFactors, siteFromSpot } from "../ginseng/model";
import { seasonStatus } from "../ginseng/rules";
import type { EsauReply } from "./types";

/**
 * What Esau can say with no signal: a short read from the rule scores alone.
 * Honest about being the short version; the full read comes when the phone reconnects.
 */
export function offlineRead(b: EsauBrief): EsauReply {
  const { spot, conditions: c, scores, species } = b;
  if (species.id === "ginseng") return ginsengOfflineRead(b);
  const top = (Object.entries(scores) as [keyof typeof scores, number][]).sort((a, z) => z[1] - a[1])[0]!;
  const role: EsauReply["spotRole"] =
    top[1] < 0.35 ? (spot.cover.woody ? "unlikely" : "open ground") : top[0] === "bedding" ? "bedding" : top[0] === "feeding" ? "feeding" : "travel";

  const ground = `${spot.aspectName ? `${spot.aspectName} ` : ""}${spot.landform} in ${spot.cover.name}`;
  const w = species.words;
  const what =
    role === "bedding" ? `reads like a place they'd ${w.bedding}` :
    role === "feeding" ? `reads like a place they'd ${w.feeding}` :
    role === "travel" ? `reads like a place they'd ${w.travel}` :
    "doesn't read like much to me";
  let wind = `Wind's ${c.windMph} out of the ${c.windFromCompass}, so your scent goes ${c.scentTowardCompass}.`;
  if (c.windMph < 2) wind = "Wind's near dead calm, so the thermals decide where your scent goes.";
  if (!species.nose) wind = `Wind's ${c.windMph} out of the ${c.windFromCompass}. They won't smell you; sit still and they won't see you either.`;
  const thermal = c.thermal.state === "settled" || !species.nose ? "" : ` ${c.thermal.plain}`;
  const scentOnIt =
    species.nose && spot.fromHunter && c.windMph >= 2 &&
    Math.abs(((spot.fromHunter.bearingDeg - c.scentToward + 540) % 360) - 180) <= 42;

  const more = [
    "This is my short read from the saved ground and the last forecast, not the full one.",
    b.legal.status === "closed" ? `Heads up: ${b.legal.note}${/KDFWR/.test(b.legal.note) ? "" : " Check the KDFWR guide before you hunt it."}` : b.legal.status === "unknown" ? "I can't confirm the season for this animal and weapon, so check the KDFWR guide first." : "",
    signToLookFor(species.id, role),
    b.legal.status === "closed" ? "" : firstSentence(b.phase.notes),
    timeOfDay(c.sun.phase, species.id),
    thermal.trim(),
    spot.trees ?? "",
    c.windMph >= 2 ? "The wind is the last forecast I got, so it may be out of date." : "",
    "The full read, with more reasons, comes when Esau's online service is available.",
  ].filter(Boolean).join(" ");

  return {
    say: `That ${ground} ${what}. ${wind}${scentOnIt ? " You're upwind of it right now; anything there will smell you." : ""}`,
    more,
    headline: scentOnIt ? "Your wind's on it" : role === "unlikely" || role === "open ground" ? "Not much here" : `Likely ${role === "bedding" ? w.bedding : role === "feeding" ? w.feeding : w.travel}`,
    confidence: "low",
    spotRole: role,
    marks: [],
    wouldChangeMyMind: ["What sign you find on the ground"],
    meta: { model: "offline-rules", servedBy: "offline-rules", inputTokens: 0, outputTokens: 0, ms: 0 },
  };
}

const firstSentence = (t: string) => {
  const guarded = t.replace(/\b(a\.m|p\.m|U\.S|vs|etc|approx)\./gi, (m) => m.replace(/\./g, "\u0000"));
  const first = (/^.*?[.!?](\s|$)/.exec(guarded)?.[0] ?? guarded).trim();
  return first.replace(/\u0000/g, ".");
};

/** What to look for on the ground at this kind of spot, in plain words. */
function signToLookFor(id: string, role: EsauReply["spotRole"]): string {
  if (role === "unlikely" || role === "open ground") return "Not much to look for here; walk on to cover or food.";
  if (id === "squirrel") return role === "feeding" ? "Look for cut hickory husks, shell bits on logs and stumps, and cuttings on the ground." : "Look for leaf nests in forks, den holes, and the creek-bottom timber they travel.";
  if (id === "turkey") return role === "feeding" ? "Look for scratched-up leaves, droppings and tracks in the dirt." : "Look for dusting bowls, roost trees with droppings below, and tracks on bare ground.";
  if (id === "whitetail" || id === "mule_deer") {
    if (role === "bedding") return "Look for oval beds pressed in leaves or grass, droppings, and a clear view downwind.";
    if (role === "feeding") return "Look for browsed twigs, fresh droppings, acorns cracked open, and tracks.";
    return "Look for a worn trail, tracks in soft dirt, rubs on small trees, and hair on fences.";
  }
  if (id === "hog") return "Look for rooting, wallows, tracks and rubbed trees.";
  return "Look for tracks, droppings and fresh sign before you commit to a spot.";
}

function timeOfDay(phase: "night" | "dawn" | "morning" | "midday" | "afternoon" | "dusk", id: string): string {
  if (id === "ginseng") return "";
  if (id === "hog" || id === "black_bear") return "";
  if (phase === "dawn" || phase === "dusk") return "Dawn and dusk are often the best movement; move slowly and get set before they do.";
  if (phase === "midday") return id === "whitetail" || id === "mule_deer" ? "" : "Midday is often the slow stretch. Sit tight or scout.";
  if (phase === "night") return "It's dark, so keep to the plan and mind your footing.";
  return "";
}

function ginsengOfflineRead(b: EsauBrief): EsauReply {
  const { spot, conditions: c } = b;
  const f = ginsengFactors(siteFromSpot(spot));
  const cls = ginsengClass(f.score);
  const season = seasonStatus(new Date(c.at));
  const role: EsauReply["spotRole"] = cls === "high" || cls === "good" ? "good ground" : cls === "fair" ? "fair ground" : "poor ground";
  const ground = `${spot.aspectName ? `${spot.aspectName} ` : ""}${spot.landform} in ${spot.cover.name}`;
  const law = season.open
    ? "Season's open through December 1, but only five-year plants with three prongs, seed back in the ground, and only with the landowner's say-so. Nothing on state or federal land."
    : "Season's closed until September 1, so scout it and leave it be.";
  return {
    say: `That ${ground} is ${CLASS_WORDS[cls]}. ${law}`,
    more: "This is my short read from the saved ground, not the full one. The map can't see the understory or the soil, so look for tulip-poplar, bloodroot, wild ginger and damp black leaf litter before you believe it. The full read comes when Esau's online service is available.",
    headline: cls === "poor" ? "Not ginseng ground" : cls === "fair" ? "Possible, not the best" : "Worth a look",
    confidence: "low",
    spotRole: role,
    marks: [],
    wouldChangeMyMind: ["Whether the understory plants are there", "Who owns the ground"],
    meta: { model: "offline-rules", servedBy: "offline-rules", inputTokens: 0, outputTokens: 0, ms: 0 },
  };
}
