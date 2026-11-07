import { countSentences, sentencesOf } from "./answer";
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
  // Nouns only: "does" and "bears" are also verbs, and "boars" are bear talk too.
  deer: /\b(deer|bucks?|fawns?|whitetails?)\b/i,
  turkey: /\b(turkeys?|gobblers?|jakes?)\b/i,
  squirrel: /\bsquirrels?\b/i,
  elk: /\belk\b/i,
  bear: /\bblack bears?\b/i,
  hog: /\b(hogs?|feral pigs?|wild pigs?)\b/i,
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

/** "Nov 14", "Nov. 14th", "November 14, 2026", and both ends of "Nov. 14-30". */
const MONTH = /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sept?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.? (\d{1,2})(?:st|nd|rd|th)?(?:\s?[-\u2013]\s?(\d{1,2})(?:st|nd|rd|th)?)?\b/g;
const MONTH_KEYS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** Every month-and-day in a text, as "nov-14". */
function dates(text: string): { key: string; said: string }[] {
  return [...text.matchAll(MONTH)].flatMap((m) => {
    const month = MONTH_KEYS.indexOf(m[1]!.slice(0, 3).toLowerCase());
    return [m[2], m[3]].filter(Boolean).map((day) => ({ key: `${month}-${Number(day)}`, said: m[0] }));
  });
}

export function checkReply(q: SpotQuery, r: EsauReply, report = buildBrief(q).report): string[] {
  const problems: string[] = [];
  const text = [r.say, r.more, r.headline, ...r.wouldChangeMyMind].join(" ");

  const mine = GROUP[q.species];
  // Naming another animal's season, its hunters or its sign is fair ("deer gun season pauses squirrel season", "the deer trail").
  const talk = text.replace(/\b\w+ (?:(?:gun|archery|crossbow|muzzleloader) )?(?:seasons?|hunters?|trails?|stands?|sign|tracks?|rubs?|scrapes?|beds?)\b/gi, " ");
  for (const [group, re] of Object.entries(ANIMAL_WORDS)) {
    if (group !== mine && re.test(talk)) problems.push(`Talks about ${group}, but the hunter is after ${mine}.`);
  }

  const known = new Set(dates(report).map((d) => d.key));
  for (const d of dates(text)) if (!known.has(d.key)) problems.push(`Gives the date "${d.said}", which is not in the field report.`);

  const n = countSentences(r.say);
  if (n > MAX_SAY) problems.push(`Short read runs ${n} sentences; the cap is ${MAX_SAY}.`);

  // Pins belong on the hunter's screen when it is known, else on the ground he read.
  const g = q.view ?? q.grid;
  for (const m of r.marks) {
    const inside = Number.isFinite(m.lat) && Number.isFinite(m.lng) && m.lat >= g.south && m.lat <= g.north && m.lng >= g.west && m.lng <= g.east;
    if (!inside) problems.push(`Puts a ${m.kind} pin "${m.label}" off ${q.view ? "the hunter's screen" : "the ground he read"}.`);
  }

  // Saying scent doesn't matter to a turkey is the right lesson; telling the hunter to work the wind for scent is not.
  const scentAdvice = (sentence: string) => /\bscent\b/i.test(sentence) && !/(eyesight|by sight|doesn't matter|does not matter|don't matter|not smell|can't smell|no matter)/i.test(sentence);
  if (q.species === "turkey" && sentencesOf(text).some(scentAdvice)) problems.push("Gives scent advice to a turkey hunter; turkeys go by eyesight.");

  return problems;
}
