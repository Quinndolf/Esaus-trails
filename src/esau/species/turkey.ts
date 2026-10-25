import type { ConditionsReading, SpotReading } from "../types";
import { clamp01, isOpen, phaseByDate, type PhaseRow } from "./common";
import type { SeasonPhase, SpeciesBrain, SpotScores } from "./types";

export const TURKEY_SOURCES: Record<string, string> = {
  dickson92: "Dickson, J.G. (ed.) 1992. The Wild Turkey: Biology and Management. Stackpole Books / National Wild Turkey Federation.",
  schorger66: "Schorger, A.W. 1966. The Wild Turkey: Its History and Domestication. University of Oklahoma Press.",
  lit: "Hunting literature: generations of turkey-hunting writing on roosting, calling, setups and strut zones. Field wisdom, not peer-reviewed.",
};

export const TURKEY_KNOWLEDGE = `
WILD TURKEY (Meleagris gallopavo) — what Esau knows. A turkey is all eyes and ears. Forget the deer playbook.

THE ANIMAL
- Turkeys have a poor sense of smell for practical purposes. Your scent does not matter. Do not waste a setup worrying about the wind for scent. [dickson92]
- What matters instead: their eyes. A turkey sees colour and the slightest movement at long range and has a wide field of view. Sit still against a tree wider than your shoulders, in shade, with your gun already up when he's coming. Their hearing is sharp too; one wrong step in dry leaves is enough. [dickson92]
- Wind still matters, but for sound: on windy days gobbles don't carry, birds can't hear calls well, they get nervous and move to open fields, sheltered hollows and the lee side of ridges. Calm, clear mornings after a front gobble best. Hard rain sends them to open fields.

DAILY RHYTHM
- Roost: turkeys fly up at dusk into big trees, often on a slope or ridge near water, on the side out of the wind, or in tall timber along creek bottoms. They gobble on the limb at first light, then fly down. [dickson92]
- After fly-down, gobblers head to strut zones: open flats, field edges, logging roads, food plots, pasture corners, oak flats, burned ground, places hens can see them. Birds feed through the morning, loaf and dust midday, feed again in the afternoon and work back toward roost. [dickson92] [lit]
- Turkeys travel easy ground. They avoid crossing creeks, deep ravines, fences, thick brush and heavy blowdowns to come to a call. Set up where there is nothing between you and the bird, ideally at the same elevation or slightly above him. [lit]

SPRING
- Spring season follows breeding. Early on, gobblers are henned up and fly down to hens; they gobble hard but follow the hens. As hens go to nest (incubation), gobblers become lonely from mid-morning on and come to a call far better. Late-morning hunts after the hens leave are often the best of the day. [dickson92] [lit]
- Don't crowd the roost. Slip in under darkness to within 100 to 200 yards on the side he'll fly down toward, without skylining yourself. Bumping a roosted bird ruins him for days.

FALL
- Fall birds run in flocks: hens with that year's poults, and separate flocks of gobblers. A broken flock regroups at the break site; calling with kee-kees and lost yelps brings them back. Check whether fall hunting and either-sex birds are legal where you are. [dickson92]

HISTORY
- Turkeys were nearly wiped out across much of their range by the early 1900s from habitat loss and market hunting and came back through restoration and trap-and-transfer. Nearly every bird a hunter sees today is the result of that work. [schorger66] [dickson92]
`.trim();

const PHASES: PhaseRow[] = [
  [0, 1, "winter flocks", "Birds are in big winter flocks near reliable food: fields, oak flats, south-facing slopes that melt off first. They roost in the same sheltered timber night after night."],
  [2, 1, "flock break-up", "Winter flocks are breaking up; gobblers start to strut and gobble on warm mornings. Good time to find roosts and strut zones."],
  [3, 1, "spring: henned up", "Breeding is on. Gobblers fly down to hens and follow them; they gobble on the limb but come to a call reluctantly. Be patient, call softly, and set up where the hens want to go."],
  [3, 25, "spring: hens nesting", "Hens are on nests through the day. Gobblers are lonely from mid-morning on and come to a call best now. Hunt late morning and midday."],
  [5, 1, "summer broods", "Hens are raising poults in grassy openings and field edges full of insects. Gobblers are in small bachelor groups. No hunting; good time to scout."],
  [8, 15, "fall flocks", "Birds run in family flocks of hens and poults, and separate gobbler groups. Find the food and roost; break the flock and call them back."],
];

function turkeyScores(spot: SpotReading, cond: ConditionsReading, _phase: SeasonPhase): SpotScores {
  // bedding = roost, feeding = feed and strut, travel = travel lanes.
  let roost = 0.08;
  if (spot.cover.woody && spot.canopy > 0.6) roost += 0.3;
  if (spot.landform === "upper slope" || spot.landform === "mid slope" || spot.landform === "creek bottom") roost += 0.15;
  if (spot.nearestWaterYd !== null && spot.nearestWaterYd < 400) roost += 0.15;
  if ((spot.nearestEdgeYd ?? 999) < 300) roost += 0.1;

  let feed = 0.1;
  if (isOpen(spot) && !spot.cover.name.includes("develop")) feed += 0.45;
  if (spot.cover.code === 41 && spot.slopeDeg < 8) feed += 0.25; // open oak flats
  if ((spot.nearestEdgeYd ?? 999) < 60) feed += 0.15;
  if (cond.windMph >= 15 && spot.reliefFt < 0) feed += 0.05; // sheltered on windy days

  let travel = 0.15;
  if (spot.slopeDeg < 10) travel += 0.2;
  if (spot.landform === "ridgetop" || spot.landform === "bench") travel += 0.2;
  if ((spot.nearestEdgeYd ?? 999) < 60) travel += 0.15;
  if (spot.slopeDeg > 25) travel -= 0.15;
  return { bedding: clamp01(roost), feeding: clamp01(feed), travel: clamp01(travel) };
}

export const turkey: SpeciesBrain = {
  id: "turkey",
  name: "wild turkey",
  ready: true,
  nose: false,
  words: { bedding: "roost", feeding: "feed and strut", travel: "travel" },
  knowledge: TURKEY_KNOWLEDGE,
  sources: TURKEY_SOURCES,
  phase: (at) => phaseByDate(PHASES, at),
  scores: turkeyScores,
};
