import type { ConditionsReading, SpotReading } from "../types";
import { clamp01, isOpen, northness, phaseByDate, type PhaseRow } from "./common";
import type { SeasonPhase, SpeciesBrain, SpotScores } from "./types";

export const ELK_SOURCES: Record<string, string> = {
  toweill02: "Toweill, D.E. & Thomas, J.W. (eds.) 2002. North American Elk: Ecology and Management. Smithsonian Institution Press / Wildlife Management Institute.",
  thomas82: "Thomas, J.W. & Toweill, D.E. (eds.) 1982. Elk of North America: Ecology and Management. Stackpole Books. (Geist, Adaptive behavioral strategies.)",
  lyon83: "Lyon, L.J. 1983. Road density models describing habitat effectiveness for elk. Journal of Forestry 81:592-595.",
  rowland00: "Rowland, M.M., Wisdom, M.J., Johnson, B.K. & Kie, J.G. 2000. Elk distribution and modeling in relation to roads. Journal of Wildlife Management 64:672-684.",
  cleveland12: "Cleveland, S.M., Hebblewhite, M., Thompson, M. & Henderson, R. 2012. Linking elk movement and resource selection to hunting pressure in a heterogeneous landscape. Wildlife Society Bulletin 36:658-668.",
  lit: "Hunting literature: decades of western elk-hunting writing on bugling, wallows, dark timber and mountain thermals. Field wisdom, not peer-reviewed.",
};

export const ELK_KNOWLEDGE = `
ELK (Cervus canadensis) — what Esau knows

THE ANIMAL
- A herd animal of big country. Cows, calves and young bulls run together; mature bulls live apart most of the year and join the cows only for the rut. Elk cover miles in a day without trying; a herd that was here yesterday may be two drainages over today. [toweill02]
- An elk's nose is its best defence and it trusts it completely. Elk will tolerate a snapped branch that sounds like another elk; they will not tolerate one whiff of a man. Eyes are good for movement, especially in open parks. [thomas82] [lit]

DAILY RHYTHM
- Feed in parks, meadows, burns, clear-cuts and open south faces at dark and first light, then climb to bed. Bed by mid-morning in dark timber, usually on north and east faces, benches and the heads of drainages, often near water or a seep. Get up for a short midday feed and water, then work back down toward feed in the last hour or two of light. [toweill02]
- In the mountains thermals run the hunt. Early morning, cool air sinks down the slopes and drainages, so come at elk from below and your scent drains away beneath you. Once the sun warms the slope (mid-morning) the air climbs all day, so approach bedded elk from above or across. In the evening the air sinks again. Swirling air where two drainages meet, and the hour around each switch, are when hunts get blown. [lit]

WATER AND WALLOWS
- Early season and rut elk hit water hard. Wallows (muddy, rank-smelling seeps, often in dark timber benches near beds) are where bulls roll in mud and urine during the rut. A fresh wallow with muddy water and tracks is current sign. [toweill02] [lit]

THE RUT
- Rut runs from late August into early October, peaking mid to late September in most of the West. Herd bulls gather cows and bugle to hold them; satellite bulls circle and try to steal cows. Bugling peaks at dawn and dusk and on cool, calm mornings. [toweill02] [thomas82]
- A herd bull with cows is hard to call away; he moves his cows away from a challenge. A satellite bull or a lone bull comes to a bugle or cow call far more readily. Calling to cows (cow talk) is often more effective than challenging.
- After the rut, mature bulls retreat to the steepest, nastiest dark timber and blowdown they can find, alone or in small bachelor groups, and feed at night. [lit]

PRESSURE AND ROADS
- Elk use of habitat drops sharply near open roads; the farther from a road, the more elk, and the effect grows with road density and traffic. [lyon83] [rowland00]
- Under hunting pressure elk shift to steep, rough, timbered country far from roads, and to private ground or closed areas where they are not hunted, often within the first days of the season. [cleveland12]
- So a spot a mile or more from the nearest road, behind a ridge, with timber, water and feed close by, is worth more than any spot near a trailhead.

LATE SEASON
- Snow pushes elk down to winter range: open south and west faces, windswept ridges and low valleys where they can paw for grass. Big storms move them; between storms they settle. [toweill02]
`.trim();

const PHASES: PhaseRow[] = [
  [0, 1, "winter range", "Elk are down on winter range in snow country: open south and west faces, windblown ridges, low valleys. They conserve energy; big storms push them lower."],
  [3, 1, "spring green-up", "Elk follow the green-up uphill as snow melts. Cows calve in late May and June in secluded cover near water and feed. Bulls are growing antlers and keep to themselves."],
  [6, 1, "summer", "Elk are high in cool basins, north faces and timbered benches near water and green feed. Bulls in velvet run in bachelor groups."],
  [7, 15, "early season", "Bulls have hard antlers and are starting to bugle. Elk are on a summer pattern, high, near water and wallows. Early archery country."],
  [8, 5, "rut", "Peak of the rut. Herd bulls are bugling and holding cows; satellites roam. Dawn and dusk are loud. Wallows are hot. Call to cows or to satellites rather than fighting a herd bull for his harem."],
  [9, 5, "post-rut", "Bulls are worn down and drift away from the cows to heal and feed, in the thickest dark timber they can find. Pressure from rifle hunters pushes elk to the steep, roadless ground."],
  [10, 1, "late fall", "Snow and pressure decide everything. Elk bunch up and start moving toward winter range. Track them in fresh snow; glass open faces at first and last light."],
  [11, 1, "winter range", "Elk are down on winter range in snow country: open south and west faces, windblown ridges, low valleys. They conserve energy; big storms push them lower."],
];

function elkScores(spot: SpotReading, cond: ConditionsReading, phase: SeasonPhase): SpotScores {
  const north = northness(spot);
  const winter = phase.id === "winter range" || phase.id === "late fall";
  let bed = 0.1;
  if (spot.cover.woody) bed += 0.3;
  bed += winter ? -north * 0.1 : north * 0.2;
  if (spot.landform === "bench" || spot.landform === "upper slope") bed += 0.15;
  if (spot.slopeDeg > 35) bed -= 0.2;
  if (spot.nearestWaterYd !== null && spot.nearestWaterYd < 600) bed += 0.1;
  if (cond.tempF > 70 && north > 0.3) bed += 0.1;

  let feed = 0.1;
  if (isOpen(spot) && !spot.cover.name.includes("develop")) feed += 0.45;
  if (spot.cover.code === 52) feed += 0.25;
  if (spot.nearestEdgeYd !== null && spot.nearestEdgeYd < 100) feed += 0.15;
  if (winter && north < -0.3) feed += 0.15;

  let travel = 0.15;
  if (spot.landform === "saddle") travel += 0.45;
  if (spot.landform === "bench" || spot.landform === "ridgetop") travel += 0.2;
  if (spot.slopeDeg > 35) travel -= 0.2;
  return { bedding: clamp01(bed), feeding: clamp01(feed), travel: clamp01(travel) };
}

export const elk: SpeciesBrain = {
  id: "elk",
  name: "elk",
  ready: true,
  nose: true,
  words: { bedding: "bed", feeding: "feed", travel: "travel through" },
  knowledge: ELK_KNOWLEDGE,
  sources: ELK_SOURCES,
  phase: (at) => phaseByDate(PHASES, at),
  scores: elkScores,
};
