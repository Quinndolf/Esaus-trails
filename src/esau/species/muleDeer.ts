import type { ConditionsReading, SpotReading } from "../types";
import { clamp01, northness, phaseByDate, type PhaseRow } from "./common";
import type { SeasonPhase, SpeciesBrain, SpotScores } from "./types";

export const MULE_DEER_SOURCES: Record<string, string> = {
  wallmo81: "Wallmo, O.C. (ed.) 1981. Mule and Black-tailed Deer of North America. University of Nebraska Press / Wildlife Management Institute. (Geist, Behavior: adaptive strategies in mule deer.)",
  heffelfinger06: "Heffelfinger, J.R. 2006. Deer of the Southwest. Texas A&M University Press.",
  sawyer09: "Sawyer, H., Kauffman, M.J. & Nielson, R.M. 2009. Influence of well pad activity on winter habitat selection patterns of mule deer. Journal of Wildlife Management 73:1052-1061.",
  sawyer11: "Sawyer, H. & Kauffman, M.J. 2011. Stopover ecology of a migratory ungulate. Journal of Animal Ecology 80:1078-1087.",
  lit: "Hunting literature: decades of western mule deer writing on glassing, spot-and-stalk and canyon thermals. Field wisdom, not peer-reviewed.",
};

export const MULE_DEER_KNOWLEDGE = `
MULE DEER (Odocoileus hemionus) — what Esau knows. Not a whitetail: a different animal with a different escape plan.

THE ANIMAL
- Mule deer live in open, broken country: sage flats, foothills, canyon rims, aspen and conifer benches, alpine basins. They rely on seeing danger at distance and getting over a ridge or around a point to break line of sight. [wallmo81]
- When spooked, a mule deer often bounds stiff-legged (stotting) uphill or across broken ground, then stops at the skyline or the edge of cover and looks back. That pause is famous; it is not guaranteed, and pressured bucks often skip it. [wallmo81] [heffelfinger06]
- They have a good nose and use the wind, but their eyes and their ground do more of the work than for a woods whitetail.

DAILY RHYTHM
- Feed at first and last light and through the night, mostly on browse (bitterbrush, mountain mahogany, sagebrush, cliffrose, serviceberry) and forbs, and on green-up and agricultural fields where they exist. [wallmo81] [heffelfinger06]
- Bed by mid-morning, usually high enough to see below: under a rimrock ledge, at the base of a lone tree on an open face, on a point or shoulder, at the head of a draw, in the shade on the north side of a bush. In heat they bed in shade on north faces and timber; in cold, in sun on south faces out of the wind. [heffelfinger06] [lit]
- Thermals rule canyon country: down-canyon air in the morning until the sun warms the slopes, up-slope through the day, down again at evening. A stalk from above on a bedded buck in the afternoon works only if the thermal is rising past him to you.

HOW THEY ARE HUNTED
- Glass first, walk second. Get high at first light, glass the feeding slopes and the edges of cover, watch where deer go to bed, then plan a stalk using the terrain to stay out of sight, with the wind and thermal in your face. [lit]

SEASONS AND MIGRATION
- Many mule deer herds migrate between high summer range and low winter range, sometimes dozens of miles, pausing at stopover areas with good forage on the way. Early fall storms start the move; deep snow finishes it. [sawyer11]
- On winter range they are stressed and avoid human disturbance; activity such as drilling and traffic pushes them off otherwise good ground. [sawyer09]
- The rut comes late: mid-November through December in most of the West, peaking around late November to early December. Bucks travel widely between doe groups and are most visible then. [wallmo81] [heffelfinger06]
`.trim();

const PHASES: PhaseRow[] = [
  [0, 1, "winter range", "Deer are on low winter range, stressed and conserving energy. South faces and wind-swept slopes with browse showing through the snow. Leave them be; scout sheds and trails."],
  [3, 1, "spring", "Deer follow the green-up back to summer range. Does fawn in June in good cover with forbs and water close by."],
  [6, 1, "summer", "Bucks in velvet bed high in basins and timbered benches and feed on open slopes at first and last light. Glass from far off."],
  [7, 20, "early season", "Bucks are hard-antlered and still on summer patterns, often high. Glass the feeding slopes at dawn, watch them bed, then plan the stalk with the thermal."],
  [9, 1, "fall", "Storms and pressure start moving deer. Some head toward winter range; bucks get secretive in timber pockets and rough canyons."],
  [10, 10, "pre-rut", "Bucks are leaving their summer haunts and drifting toward doe groups on transition and winter ranges."],
  [10, 20, "rut", "Rut is on. Bucks travel between doe groups day and night; find the does and the bucks come to you. Glass open faces near doe groups all day."],
  [11, 15, "post-rut", "Bucks are run down and feed hard on winter range. Deer are concentrated and stressed: hunt them clean or let them be."],
];

function muleDeerScores(spot: SpotReading, cond: ConditionsReading): SpotScores {
  const north = northness(spot);
  const hot = cond.tempF >= 60;
  let bed = 0.12;
  if (["point", "upper slope", "ridgetop", "bench"].includes(spot.landform)) bed += 0.2;
  if (spot.slopeDeg >= 10 && spot.slopeDeg <= 35) bed += 0.12;
  if (spot.cover.code === 52 || spot.cover.woody) bed += 0.15;
  bed += hot ? north * 0.15 : -north * 0.15;
  if (spot.reliefFt > 40) bed += 0.1;

  let feed = 0.1;
  if (spot.cover.code === 52) feed += 0.45; // shrub: browse
  if (spot.cover.code === 71 || spot.cover.code === 81) feed += 0.3;
  if (spot.crop || spot.cover.code === 82) feed += 0.35;
  if (spot.cover.woody && spot.nearestEdgeYd !== null && spot.nearestEdgeYd < 80) feed += 0.15;

  let travel = 0.15;
  if (spot.landform === "saddle" || spot.landform === "draw") travel += 0.35;
  if (spot.landform === "bench") travel += 0.2;
  return { bedding: clamp01(bed), feeding: clamp01(feed), travel: clamp01(travel) };
}

export const muleDeer: SpeciesBrain = {
  id: "mule_deer",
  name: "mule deer",
  ready: true,
  nose: true,
  words: { bedding: "bed", feeding: "feed", travel: "travel through" },
  knowledge: MULE_DEER_KNOWLEDGE,
  sources: MULE_DEER_SOURCES,
  phase: (at: Date): SeasonPhase => phaseByDate(PHASES, at),
  scores: muleDeerScores,
};
