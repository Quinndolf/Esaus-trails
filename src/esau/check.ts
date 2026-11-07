import { countSentences } from "./answer";
import { buildBrief } from "./brief";
import type { EsauReply, SpeciesId, SpotQuery } from "./types";

/**
 * Rules every answer from Esau must keep, checked against the field report he was given.
 * Used by the sample-spot run (npm run esau:spots) and logged by the server, so a slip shows up.
 * Returns plain-words problems; empty means the answer kept every rule.
 */

const MAX_SAY = 4;

/** Words that name each animal, grouped so mule deer and whitetail share "deer". */
const ANIMAL_WORDS: Record<string, RegExp> = {
  deer: /\b(deer|bucks?|does|fawns?|whitetails?)\b/i,
  turkey: /\b(turkeys?|gobblers?|jakes?)\b/i,
  squirrel: /\bsquirrels?\b/i,
  elk: /\belk\b/i,
  bear: /\bbears?\b/i,
  hog: /\b(hogs?|boars?|feral pigs?)\b/i,
  ginseng: /\b(ginseng|'?seng)\b/i,
};
const GROUP: Record<SpeciesId, string> = {
  whitetail: "deer",
  mule_deer: "deer",
  turkey: "turkey",
  squirrel: "squirrel",
  elk: "elk",
  black_bear: "bear",
  hog: "hog",
  ginseng: "ginseng",
};

const MONTH = /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sept?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.? (\d{1,2})\b/g;
const MONTH_KEYS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** Every month-and-day in a text, as "nov-14". */
function dates(text: string): { key: string; said: string }[] {
  return [...text.matchAll(MONTH)].map((m) => ({ key: `${MONTH_KEYS.indexOf(m[1]!.slice(0, 3).toLowerCase())}-${Number(m[2])}`, said: m[0] }));
}

export function checkReply(q: SpotQuery, r: EsauReply, report = buildBrief(q).report): string[] {
  const problems: string[] = [];
  const text = [r.say, r.more, r.headline, ...r.wouldChangeMyMind].join(" ");

  const mine = GROUP[q.species];
  // Naming another animal's season or its hunters is fair ("deer gun season pauses squirrel season").
  const talk = text.replace(/\b\w+ (?:(?:gun|archery|crossbow|muzzleloader) )?(?:seasons?|hunters?)\b/gi, " ");
  for (const [group, re] of Object.entries(ANIMAL_WORDS)) {
    if (group !== mine && re.test(talk)) problems.push(`Talks about ${group}, but the hunter is after ${mine}.`);
  }

  const known = new Set(dates(report).map((d) => d.key));
  for (const d of dates(text)) if (!known.has(d.key)) problems.push(`Gives the date "${d.said}", which is not in the field report.`);

  const n = countSentences(r.say);
  if (n > MAX_SAY) problems.push(`Short read runs ${n} sentences; the cap is ${MAX_SAY}.`);

  const g = q.grid;
  for (const m of r.marks) {
    const inside = Number.isFinite(m.lat) && Number.isFinite(m.lng) && m.lat >= g.south && m.lat <= g.north && m.lng >= g.west && m.lng <= g.east;
    if (!inside) problems.push(`Puts a ${m.kind} pin "${m.label}" off the ground he read.`);
  }

  if (q.species === "turkey" && /\bscent\b/i.test(text)) problems.push("Gives scent advice to a turkey hunter; turkeys go by eyesight.");

  return problems;
}
