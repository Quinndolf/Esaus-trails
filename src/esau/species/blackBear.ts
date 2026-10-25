import type { ConditionsReading, SpotReading } from "../types";
import { clamp01, phaseByDate, type PhaseRow } from "./common";
import type { SeasonPhase, SpeciesBrain, SpotScores } from "./types";

export const BLACK_BEAR_SOURCES: Record<string, string> = {
  pelton03: "Pelton, M.R. 2003. Black bear (Ursus americanus). In Feldhamer, G.A., Thompson, B.C. & Chapman, J.A. (eds.) Wild Mammals of North America, 2nd ed. Johns Hopkins University Press.",
  rogers87: "Rogers, L.L. 1987. Effects of food supply and kinship on social behavior, movements, and population growth of black bears in northeastern Minnesota. Wildlife Monographs 97.",
  garshelis80: "Garshelis, D.L. & Pelton, M.R. 1980. Activity of black bears in the Great Smoky Mountains National Park. Journal of Mammalogy 61:8-19.",
  herrero85: "Herrero, S. 1985. Bear Attacks: Their Causes and Avoidance. Lyons & Burford.",
  lit: "Hunting literature: decades of bear-hunting writing on food sources, sign and spot-and-stalk. Field wisdom, not peer-reviewed.",
};

export const BLACK_BEAR_KNOWLEDGE = `
BLACK BEAR (Ursus americanus) — what Esau knows. A bear is a stomach with a nose; find this week's food and you find the bear.

THE ANIMAL
- A black bear's nose is the best in the woods, far better than a deer's. Wind and thermals are everything; a bear that smells you is gone, usually without you ever knowing it was there. Eyesight is fair, hearing good. [pelton03]
- Bears are mostly solitary. Sows with cubs avoid adult boars. In many places it is illegal to take a sow with cubs or a cub; look hard before you shoot. Methods (bait, hounds, spot-and-stalk) and seasons vary widely by state; follow the regulations where you are.
- Activity is mostly at dawn, dusk and through the day in wild country, and shifts toward night near people and under pressure. [garshelis80]

FOOD, BY SEASON
- Spring, out of the den: bears are lean and eat green-up — grasses, sedges, clover on open slopes, roadsides and clearings, skunk cabbage in wet ground — plus winter-killed carrion and newborn deer and elk calves where they can find them. South-facing slopes green up first. [pelton03] [rogers87]
- Summer: soft mast. Blueberries, raspberries, blackberries, serviceberry, cherry, and insects (ants, bee and wasp nests, beetle grubs in rotten logs). Berry crops shift bears around from week to week. [rogers87]
- Fall: hyperphagia. Bears eat nearly around the clock to fatten for the den, on hard mast (acorns, beechnuts, hickory), late berries, apples, and corn where fields meet cover. A good mast year keeps them in the timber; a failure sends them roaming and into fields and towns. [rogers87] [pelton03]

WHERE THEY BED AND TRAVEL
- Bears bed close to food in the thickest cover going: laurel and rhododendron hells, swamps and cedar bogs, blowdowns, dense young timber, thick north faces. They use creek bottoms, logging roads, ridgelines and field edges to travel between food and cover. [lit]
- Sign to look for: scat full of whatever they are eating, torn-up logs and stumps, flipped rocks, broken limbs in fruit and nut trees, claw marks, flattened berry patches, bear trails with staggered "stepping" tracks in old travel routes.

DENNING
- Bears den when food runs out and cold sets in: pregnant sows first (often October to November), boars last, some not until December, and in the South some barely den at all. They come out in March to May, boars first. [pelton03]

SAFETY
- Most black bears flee people. Food-conditioned bears, sows defending cubs and the rare predatory bear are the exceptions. Make noise when tracking a hit bear, do not follow one into thick cover at dark, and carry bear spray where bears are common. [herrero85]
`.trim();

const PHASES: PhaseRow[] = [
  [0, 1, "denning", "Most bears are denned. In the South some stay active through mild spells. There is nothing to hunt; it's a time to scout last fall's food and travel sign."],
  [2, 15, "spring emergence", "Bears are leaving dens, boars first, sows with new cubs last. They are lean and hungry: green-up on south slopes, clearings, roadsides and wet seeps, plus carrion. Glass open green slopes in the evening."],
  [5, 1, "early summer", "Breeding season (June and July). Boars roam widely after sows. Green feed is getting tough; bears turn to insects and the first berries."],
  [6, 15, "berry season", "Soft mast time. Find the ripe berry patches this week and the bears will be in them, often in the open early and late. Ripe crops move up the mountain as summer goes on."],
  [8, 1, "fall hyperphagia", "Bears are feeding nearly around the clock to fatten up. Acorns, beechnuts, hickory, apples and corn. Find the best food source in thick cover and play the wind perfectly."],
  [10, 1, "late fall", "Pregnant sows are already denning; boars feed on whatever mast remains until it runs out or the weather turns hard. Fresh sign in mast stands still means a bear is up."],
  [11, 15, "denning", "Most bears are denned. In the South some stay active through mild spells. There is nothing to hunt; it's a time to scout last fall's food and travel sign."],
];

function blackBearScores(spot: SpotReading, _cond: ConditionsReading, phase: SeasonPhase): SpotScores {
  let bed = 0.08;
  if (spot.cover.woody) bed += 0.3;
  if (spot.cover.code === 90) bed += 0.15; // swamp
  if (spot.cover.code === 42) bed += 0.1; // evergreen thickets
  if (spot.slopeDeg > 15) bed += 0.1;
  if (spot.nearestFoodYd !== null && spot.nearestFoodYd < 500) bed += 0.1;

  let feed = 0.15;
  if (phase.id === "spring emergence" && !spot.cover.woody && spot.cover.code !== 11) feed += 0.4;
  if (phase.id === "berry season" && (spot.cover.code === 52 || (spot.nearestEdgeYd ?? 999) < 60)) feed += 0.45;
  if (phase.id === "fall hyperphagia" || phase.id === "late fall") {
    if (spot.cover.code === 41 || spot.cover.code === 43) feed += 0.35; // hardwood mast
    if (spot.crop || spot.cover.code === 82) feed += 0.3;
  }

  let travel = 0.15;
  if (spot.landform === "draw" || spot.landform === "creek bottom") travel += 0.3;
  if (spot.landform === "ridgetop" || spot.landform === "saddle") travel += 0.2;
  if ((spot.nearestEdgeYd ?? 999) < 50) travel += 0.15;
  return { bedding: clamp01(bed), feeding: clamp01(feed), travel: clamp01(travel) };
}

export const blackBear: SpeciesBrain = {
  id: "black_bear",
  name: "black bear",
  ready: true,
  nose: true,
  words: { bedding: "bed up", feeding: "feed", travel: "travel through" },
  knowledge: BLACK_BEAR_KNOWLEDGE,
  sources: BLACK_BEAR_SOURCES,
  phase: (at) => phaseByDate(PHASES, at),
  scores: blackBearScores,
};
