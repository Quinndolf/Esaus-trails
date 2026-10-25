import type { EsauBrief } from "./brief";
import type { EsauReply } from "./types";

/**
 * What Esau can say with no signal: a short read from the rule scores alone.
 * Honest about being the short version; the full read comes when the phone reconnects.
 */
export function offlineRead(b: EsauBrief): EsauReply {
  const { spot, conditions: c, scores } = b;
  const top = (Object.entries(scores) as [keyof typeof scores, number][]).sort((a, z) => z[1] - a[1])[0]!;
  const role: EsauReply["spotRole"] =
    top[1] < 0.35 ? (spot.cover.woody ? "unlikely" : "open ground") : top[0] === "bedding" ? "bedding" : top[0] === "feeding" ? "feeding" : "travel";

  const ground = `${spot.aspectName ? `${spot.aspectName} ` : ""}${spot.landform} in ${spot.cover.name}`;
  const what =
    role === "bedding" ? "reads like a place they'd bed" :
    role === "feeding" ? "reads like a place they'd feed" :
    role === "travel" ? "reads like a place they'd walk through" :
    "doesn't read like much to me";
  let wind = `Wind's ${c.windMph} out of the ${c.windFromCompass}, so your scent goes ${c.scentTowardCompass}.`;
  if (c.windMph < 2) wind = "Wind's near dead calm, so the thermals decide where your scent goes.";
  const thermal = c.thermal.state === "settled" ? "" : ` ${c.thermal.plain}`;
  const scentOnIt =
    spot.fromHunter && c.windMph >= 2 &&
    Math.abs(((spot.fromHunter.bearingDeg - c.scentToward + 540) % 360) - 180) <= 42;

  return {
    say: `No signal, so this is the short version. That ${ground} ${what}. ${wind}${thermal}${scentOnIt ? " You're upwind of it right now; anything there will smell you." : ""} I'll give you the full read when you're back in service.`,
    headline: scentOnIt ? "Your wind's on it" : role === "unlikely" || role === "open ground" ? "Not much here" : `Likely ${role}`,
    confidence: "low",
    spotRole: role,
    marks: [],
    wouldChangeMyMind: ["What sign you find on the ground"],
    meta: { model: "offline-rules", servedBy: "offline-rules", inputTokens: 0, outputTokens: 0, ms: 0 },
  };
}
