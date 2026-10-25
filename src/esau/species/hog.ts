import type { ConditionsReading, SpotReading } from "../types";
import { clamp01, phaseByDate, type PhaseRow } from "./common";
import type { SeasonPhase, SpeciesBrain, SpotScores } from "./types";

export const HOG_SOURCES: Record<string, string> = {
  mayer09: "Mayer, J.J. & Brisbin, I.L. Jr. (eds.) 2009. Wild Pigs: Biology, Damage, Control Techniques and Management. Savannah River National Laboratory.",
  vercauteren20: "VerCauteren, K.C., Beasley, J.C., Ditchkoff, S.S., Mayer, J.J., Roloff, G.J. & Strickland, B.K. (eds.) 2020. Invasive Wild Pigs in North America: Ecology, Impacts, and Management. CRC Press.",
  kay17: "Kay, S.L., Fischer, J.W., Monaghan, A.J., et al. 2017. Quantifying drivers of wild pig movement across multiple spatial and temporal scales. Movement Ecology 5:14.",
  lit: "Hunting literature: field writing on hunting wild hogs over sign, water and crops. Field wisdom, not peer-reviewed.",
};

export const HOG_KNOWLEDGE = `
WILD HOG (feral swine, Sus scrofa) — what Esau knows. Not a game animal in the old sense: an invasive pig that wrecks ground. Hunt it like the nose it is.

THE ANIMAL
- A hog's nose is superb; it finds acorns and grubs underground and it will smell you just as well. Eyesight is poor, hearing good. Play the wind and thermals as carefully as for a bear, and move slow and low; a hog often doesn't pick out a still shape. [mayer09]
- Sows and their young run in family groups (sounders), from a handful to dozens. Mature boars mostly live alone and join sounders to breed. [mayer09] [vercauteren20]
- Hogs breed year-round, so there is no rut to plan around, only food, water and temperature.

HEAT, WATER AND WALLOWS
- Pigs can't sweat. They cool off in mud wallows, shade and water, so in heat they bed in the thickest, wettest cover available and move mostly at night. In cool weather they move more by day. Temperature is one of the strongest drivers of when hogs move. [kay17] [mayer09]
- Fresh wallows (muddy water, wet mud slicked on nearby trees and posts as "rub" marks), along with rooting, are the best current sign.

WHERE THEY BED AND FEED
- Bedding: dense, low cover close to water: palmetto, briar and cane thickets, cattail and sedge sloughs, young pine plantations, swamp edges. They often build nests of piled grass and brush. [mayer09]
- Feeding: acorns and other hard mast in fall and winter; crops (corn, peanuts, sorghum, wheat, soybeans) almost any time; roots, tubers, grubs and worms in moist bottoms and field edges, leaving ground plowed up as if with a disc. [mayer09] [vercauteren20]
- Travel: creek and river bottoms, drainages, field edges, fence lines and the same trails night after night between bedding, water and food.

PRESSURE AND RULES
- Hogs learn fast. Pressure pushes a sounder fully nocturnal or off the property in days; shooting one pig from a sounder educates the rest. [vercauteren20]
- They are an invasive species. Many states allow year-round hunting, night hunting or landowner removal with few limits; some states and public lands restrict or prohibit sport hunting so sounders don't scatter and spread. Check the rules where you are. [vercauteren20]
`.trim();

const PHASES: PhaseRow[] = [
  [0, 1, "winter", "Cool weather: hogs move more in daylight, especially afternoons. Hard mast and crop stubble draw them. Wallows matter less; sheltered thick bedding matters more."],
  [2, 1, "spring", "Green-up and fresh rooting in moist bottoms. Many sows farrow now (though pigs breed all year). Warming days start pushing movement later."],
  [4, 15, "summer heat", "Heat makes hogs nocturnal. They bed in wet, shaded thickets close to water and wallows and come out after dark to crops. Hunt water and wallows at last light, or at night where legal."],
  [8, 15, "fall mast", "Acorns are dropping and hogs follow them hard, along with harvested fields. Cooler mornings bring more daylight movement."],
];

function hogScores(spot: SpotReading, cond: ConditionsReading, _phase: SeasonPhase): SpotScores {
  const hot = cond.tempF >= 75;
  let bed = 0.08;
  if (spot.cover.code === 90 || spot.cover.code === 95) bed += 0.35; // wet thickets
  if (spot.cover.code === 52 || spot.cover.code === 42) bed += 0.25;
  else if (spot.cover.woody) bed += 0.15;
  if (spot.nearestWaterYd !== null && spot.nearestWaterYd < 300) bed += hot ? 0.25 : 0.1;
  if (spot.landform === "creek bottom" || spot.landform === "draw") bed += 0.1;

  let feed = 0.1;
  if (spot.crop || spot.cover.code === 82) feed += 0.45;
  if ((spot.cover.code === 41 || spot.cover.code === 43) && !hot) feed += 0.25; // mast
  if (spot.landform === "creek bottom") feed += 0.15; // rooting ground

  let travel = 0.15;
  if (spot.landform === "creek bottom" || spot.landform === "draw") travel += 0.35;
  if ((spot.nearestEdgeYd ?? 999) < 50) travel += 0.2;
  if (spot.slopeDeg > 20) travel -= 0.15;
  return { bedding: clamp01(bed), feeding: clamp01(feed), travel: clamp01(travel) };
}

export const hog: SpeciesBrain = {
  id: "hog",
  name: "wild hog",
  ready: true,
  nose: true,
  words: { bedding: "bed", feeding: "root and feed", travel: "travel through" },
  knowledge: HOG_KNOWLEDGE,
  sources: HOG_SOURCES,
  phase: (at) => phaseByDate(PHASES, at),
  scores: hogScores,
};
