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

  return {
    say: `No signal, so this is the short version. That ${ground} ${what}. ${wind}${thermal}${scentOnIt ? " You're upwind of it right now; anything there will smell you." : ""} I'll give you the full read when you're back in service.`,
    headline: scentOnIt ? "Your wind's on it" : role === "unlikely" || role === "open ground" ? "Not much here" : `Likely ${role === "bedding" ? w.bedding : role === "feeding" ? w.feeding : w.travel}`,
    confidence: "low",
    spotRole: role,
    marks: [],
    wouldChangeMyMind: ["What sign you find on the ground"],
    meta: { model: "offline-rules", servedBy: "offline-rules", inputTokens: 0, outputTokens: 0, ms: 0 },
  };
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
    say: `No signal, so this is the short version. That ${ground} is ${CLASS_WORDS[cls]}. The map can't see the understory or the soil, so look for tulip-poplar, bloodroot, wild ginger and damp black leaf litter before you believe it. ${law} I'll give you the full read when you're back in service.`,
    headline: cls === "poor" ? "Not ginseng ground" : cls === "fair" ? "Possible, not the best" : "Worth a look",
    confidence: "low",
    spotRole: role,
    marks: [],
    wouldChangeMyMind: ["Whether the understory plants are there", "Who owns the ground"],
    meta: { model: "offline-rules", servedBy: "offline-rules", inputTokens: 0, outputTokens: 0, ms: 0 },
  };
}
