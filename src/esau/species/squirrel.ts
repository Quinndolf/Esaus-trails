import type { ConditionsReading, SpotReading } from "../types";
import { clamp01, phaseByDate, type PhaseRow } from "./common";
import type { SeasonPhase, SpeciesBrain, SpotScores } from "./types";

export const SQUIRREL_SOURCES: Record<string, string> = {
  koprowski94g: "Koprowski, J.L. 1994. Sciurus carolinensis. Mammalian Species 480. American Society of Mammalogists.",
  koprowski94f: "Koprowski, J.L. 1994. Sciurus niger. Mammalian Species 479. American Society of Mammalogists.",
  steele01: "Steele, M.A. and Koprowski, J.L. 2001. North American Tree Squirrels. Smithsonian Institution Press.",
  lit: "Hunting literature: generations of squirrel-hunting writing on cuttings, still-hunting and reading a woodlot. Field wisdom, not peer-reviewed.",
};

export const SQUIRREL_KNOWLEDGE = `
SQUIRREL (eastern gray, Sciurus carolinensis, and fox squirrel, Sciurus niger) — what Esau knows. A squirrel hunt is a sit-and-listen hunt under a nut tree. Forget the deer playbook.

THE ANIMAL
- Two game squirrels in the eastern woods. Grays live in big, continuous hardwood forest with oak, hickory, beech and walnut. Fox squirrels are bigger, slower and fond of open, patchy woodlots, fencerows and field edges, and spend more time on the ground. In a mixed woodlot you can have both. [koprowski94g] [koprowski94f] [steele01]
- Squirrels see and hear well. Your scent is not a worry; your movement and noise are. A squirrel that has spotted you will freeze, flatten along a limb or circle the trunk to keep the tree between you and it. Wait it out. [lit]
- Wind matters for sound and for the squirrel's mood, not for scent. A light breeze covers your steps. A hard wind shakes the canopy, hides the sound of cutting and keeps squirrels in the den or low. [lit]

DAILY RHYTHM
- Squirrels are day animals. There are two feeding peaks: a strong one starting around first light and running a few hours, and a smaller one in the late afternoon. In hot weather the morning peak is the one to hunt and midday is dead. In cold winter weather the activity slides later and a warm midday can be the best time. [steele01] [koprowski94g]
- At night and in hard rain or cold squirrels sit in tree cavities. In warm weather they also use leaf nests built in forks high in the canopy. A den tree with a hole, or a bundle of leaves in a fork, tells you squirrels live there, not that they are out. [koprowski94g] [steele01]

FEEDING
- Squirrels follow the mast. Early in the season they cut green hickory nuts, then work the oak acorns, beech, walnut and later whatever they cached. Find the best nut-bearing tree in the woods that year and you have found the squirrels. [steele01] [koprowski94g]
- Sign: piles of hickory husks and nut fragments on logs, stumps and the ground below a tree; shell bits falling through the leaves; cuttings (nut clusters dropped from the branch) on the ground. Fresh, clean-edged pieces mean they were here this morning. [lit]
- Grays bury nuts one at a time in the fall (scatter hoarding) and dig them up through the winter, so in winter you see more scratching and digging on the ground in oak and hickory flats. [steele01]

HUNTING THE GROUND
- Get in before first light, quietly, and sit with your back against a tree facing a stand of nut trees. Listen: cutting sounds, falling hulls, the rustle of a squirrel running a limb. Most are found by ear first. [lit]
- Streams, creek bottoms and mature timber along them hold squirrels and give a squirrel a travel route between dens and mast trees. Fencerows tie woodlots together for fox squirrels. [koprowski94f] [lit]
- After a shot the neighbourhood goes quiet for a while. Sit tight; they come back.

SEASON AND BREEDING
- Gray and fox squirrels typically breed twice a year, in mid to late winter and again in early summer, so winter chases and summer litters shape what you see. The season runs from late summer into late winter in Kentucky; check the hunting guide for the dates and limits that apply on your ground. [koprowski94g] [koprowski94f]
`.trim();

const PHASES: PhaseRow[] = [
  [0, 1, "winter: breeding chases", "Cold-weather squirrels sit in cavities on the coldest, windiest days and feed in the warm middle of the day. Mid to late winter brings breeding chases through the woods. Dig-and-scratch sign shows where they are retrieving buried nuts."],
  [3, 1, "closed: spring and summer", "Spring and early summer is nesting and litter time. Good for scouting den trees and mast trees, not for hunting."],
  [7, 15, "early season: hickory cutting", "Hickories are cutting. Squirrels feed at first light in the hickories and the first oaks to drop. Early-season mornings are hot and short; be in place at dawn."],
  [9, 1, "fall: acorns and caching", "Oaks and beech are dropping. Squirrels feed hard and bury nuts. Sit near the best acorn tree and listen for cutting and rustling in the leaves."],
  [11, 1, "winter: leaf-nest and cavity", "Cold weather shifts activity toward the warmest part of the day. Watch cavities and big oak flats where they dig up their caches."],
];

function squirrelScores(spot: SpotReading, cond: ConditionsReading, _phase: SeasonPhase): SpotScores {
  // bedding = den and nest trees, feeding = nut and mast trees, travel = routes between them.
  const mature = spot.cover.code === 41 || spot.cover.code === 43;
  let den = 0.08;
  if (spot.cover.woody && spot.canopy > 0.6) den += 0.3;
  if (mature) den += 0.15;
  if (spot.landform === "creek bottom" || spot.landform === "lower slope") den += 0.15;
  if (spot.nearestWaterYd !== null && spot.nearestWaterYd < 300) den += 0.1;

  let feed = 0.08;
  if (spot.cover.code === 41) feed += 0.4;
  else if (spot.cover.code === 43) feed += 0.25;
  if (spot.canopy > 0.5) feed += 0.15;
  if ((spot.nearestEdgeYd ?? 999) < 80 && spot.cover.woody) feed += 0.12;
  if (cond.windMph >= 15) feed -= 0.12;

  let travel = 0.12;
  if (spot.landform === "creek bottom") travel += 0.25;
  if ((spot.nearestEdgeYd ?? 999) < 40) travel += 0.2;
  if (spot.cover.woody && spot.canopy > 0.5) travel += 0.15;
  return { bedding: clamp01(den), feeding: clamp01(feed), travel: clamp01(travel) };
}

export const squirrel: SpeciesBrain = {
  id: "squirrel",
  name: "squirrel",
  ready: true,
  nose: false,
  words: { bedding: "den", feeding: "feed", travel: "travel" },
  knowledge: SQUIRREL_KNOWLEDGE,
  sources: SQUIRREL_SOURCES,
  phase: (at) => phaseByDate(PHASES, at),
  scores: squirrelScores,
};
