import type { ConditionsReading, SpotReading } from "../types";
import type { SeasonPhase, SpeciesBrain, SpotScores } from "./types";

/**
 * Sources Esau may name. Keys are referenced from the knowledge text as [key].
 * Only works that exist belong here; the prompt forbids citing anything else.
 */
export const WHITETAIL_SOURCES: Record<string, string> = {
  halls84: "Halls, L.K. (ed.) 1984. White-tailed Deer: Ecology and Management. Stackpole Books / Wildlife Management Institute. (Marchinton & Hirth, ch. 6, Behavior.)",
  hewitt11: "Hewitt, D.G. (ed.) 2011. Biology and Management of White-tailed Deer. CRC Press.",
  beier90: "Beier, P. & McCullough, D.R. 1990. Factors influencing white-tailed deer activity patterns and habitat use. Wildlife Monographs 109.",
  kile77: "Kile, T.L. & Marchinton, R.L. 1977. White-tailed deer rubs and scrapes: spatial, temporal and physical characteristics and social role. American Midland Naturalist 97:257-266.",
  kilgo98: "Kilgo, J.C., Labisky, R.F. & Fritzen, D.E. 1998. Influences of hunting on the behavior of white-tailed deer. Conservation Biology 12:1359-1364.",
  karns11: "Karns, G.R., Lancia, R.A., DePerno, C.S. & Conner, M.C. 2011. Investigation of adult male white-tailed deer excursions outside their home range. Southeastern Naturalist 10:39-52.",
  ozoga: "Ozoga, J.J. Whitetail Autumn (1994), Whitetail Winter (1995), Whitetail Spring (1996). Willow Creek Press.",
  atkeson88: "Atkeson, T.D., Marchinton, R.L. & Miller, K.V. 1988. Vocalizations of white-tailed deer. American Midland Naturalist 120:194-200.",
  webb10: "Webb, S.L., Gee, K.L., Strickland, B.K., Demarais, S. & DeYoung, R.W. 2010. Measuring fine-scale white-tailed deer movements and environmental influences using GPS collars. International Journal of Ecology, article 459610.",
  goethlich19: "Goethlich, J. 2019. Effects of abiotic factors on white-tailed deer activity in South Carolina. MS thesis, Auburn University.",
  karns08: "Karns, G.R. 2008. Impact of hunting pressure on adult male white-tailed deer behavior. MS thesis, North Carolina State University (Chesapeake Farms, Maryland).",
  msu20: "Demarais, S. & Castle, L. (Mississippi State University Deer Lab). 2020. Research sheds light on best times to hunt bucks. MSU Extension, 19 Nov 2020 (GPS collars on 40+ bucks, Mississippi).",
  mooney1900: "Mooney, J. 1900. Myths of the Cherokee. 19th Annual Report, Bureau of American Ethnology. (Awi Usdi, the Little Deer.)",
  abrams08: "Abrams, M.D. & Nowacki, G.J. 2008. Native Americans as active and passive promoters of mast and fruit trees in the eastern USA. The Holocene 18:1123-1137.",
  lit: "Hunting literature: decades of field writing on mature-buck bedding, wind and access (e.g. the bedding-area and saddle work common to modern whitetail hunting books and magazines). Field wisdom, not peer-reviewed; Esau says so when it matters.",
};

/** Stable knowledge block. Lives in the cached system prompt, so keep it free of anything per-request. */
export const WHITETAIL_KNOWLEDGE = `
WHITETAIL DEER (Odocoileus virginianus) — what Esau knows

DAILY RHYTHM
- Deer are crepuscular: movement peaks around sunrise and sunset, with a smaller midday stir and night feeding. [beier90] [hewitt11]
- Typical day outside the rut: feed at night and into first light, move back toward cover at dawn, bed by mid-morning, get up to stretch and browse near the bed around midday, start drifting toward food in the last two hours of light. [halls84]
- Heat, wind over about 15-20 mph, and heavy daytime pressure all push movement later and shorter. Hard rain shuts it down; deer often move right after a front passes. [beier90] [lit]

BEDDING
- Deer bed in security cover: thick regrowth, cutover, cedar or pine thickets, CRP/old-field, cattail edges, laurel and briar on a slope. Does and fawns bed in family groups, often nearer food. Mature bucks bed alone, apart from does, in the cover that is hardest to approach. [halls84] [ozoga]
- Mature bucks favour terrain that lets them smell what is behind them and see what is in front: the leeward (downwind) side of a ridge point, a bench one-third down from the crest, the end of a finger ridge. They tend to bed with the wind at their back looking downhill. This is field wisdom from the hunting literature, widely repeated and consistent with how scent and sight work, but not a peer-reviewed rule. [lit]
- Temperature changes the slope they choose: on cold, clear days south and southwest faces catch sun and break the wind; in heat, north and east faces, deep shade and low ground near water. Evergreen thermal cover matters most in hard winter. [ozoga] [hewitt11]
- Beds are usually within a few hundred yards of a reliable food source outside the rut; doe groups closer, bucks farther and in rougher ground.

FEEDING
- Deer are browsers and selective feeders. Fall foods in order of draw where available: acorns (white oak drops first and is preferred over red), soybeans (green in early season, pods once dry), corn after harvest, brassicas and cereal grains (wheat, oats, rye) once frost sweetens them, alfalfa and clover, persimmon, apple, honeysuckle and greenbrier browse. [halls84] [hewitt11]
- A hard acorn crop pulls deer off the fields and into the timber; a mast failure pushes them hard onto ag and food plots. Ask or infer which year it is before betting on a field.
- Fresh cutover and burned ground produce browse within a year or two and draw deer for years. Eastern nations burned the woods for exactly this: to open the understory and favour oaks, chestnut and fruit trees, and the deer came. [abrams08]

TRAVEL
- Deer take the easiest route that keeps them safe: saddles and low gaps in a ridge, benches on a sidehill, the heads and edges of draws, inside corners of field edges, creek crossings with firm banks, and fence gaps. Funnels where cover pinches between open ground or water concentrate movement. [lit] [halls84]
- Does trail bed-to-feed on predictable, well-worn runs. Mature bucks parallel those runs on the downwind side, often just inside cover, to scent-check them. [lit]
- Deer move with the wind in their face or quartering when they can, and check thermals off low ground in the evening.

THE RUT
- Rubs and scrapes are signposts. Rubs line travel routes and cluster near bedding; scrapes concentrate along edges, old logging roads and under licking branches, and peak in the two or three weeks before peak breeding. Scrape activity drops off during peak breeding. [kile77]
- Phases (dates shift with region and latitude): pre-rut (bucks rubbing, scraping, sparring, still on a loose pattern); seeking and chasing (bucks cover ground in daylight, cruise downwind of doe bedding, check doe groups); breeding or lockdown (a buck tends one doe for a day or two, often in odd, small cover; sightings drop); post-rut (bucks worn down, back on food, cautious); a smaller second rut about 28 days after peak when unbred does and doe fawns cycle. [halls84] [ozoga]
- During the rut mature bucks take excursions outside their normal home range, sometimes for a day and miles away; a big buck can show up anywhere. [karns11]
- Peak breeding varies a great deal: mid-November across most of the North and Midwest, but anywhere from October to January in the South. State agency breeding-date data beats any rule of thumb.

SCENT, WIND AND PRESSURE
- A deer's nose is its first line of defence. Anything downwind of the hunter for a few hundred yards will likely smell him; a deer that winds a hunter at close range blows, stomps or slips out and often avoids that spot for days. [halls84]
- Thermals: after sunrise, as slopes warm, air drifts uphill; in the evening and at night cooling air sinks and drains down slopes and draws, pooling in bottoms. On calm days thermals can matter more than the forecast wind. A shaded north face can stay in down-drift while a sunny south face is rising. Thermals switch around an hour or two after sunrise and an hour or so before sunset.
- Hunting pressure pushes deer into thicker cover, steeper ground and more night movement, and changes it fast: research on hunted versus unhunted deer found they shifted into denser cover and became more nocturnal once the guns came out. [kilgo98]
- Access is half the hunt. The best stand is worthless if the walk in blows the bedding area or crosses the food deer will be on.

WEATHER, PRESSURE, MOON AND CALLS — what the research says, and how far to trust it
- Time of day beats weather. In a South Carolina GPS-collar study, deer were on their feet about 78% of evening hours, 65% of mornings, 62% of nights and 26% of daylight hours, and the effects of weather, pressure and moon were "typically less pronounced" than that daily cycle, mostly showing up outside the peak hours. [goethlich19]
- Temperature: activity is highest at moderate temperatures and falls as snow deepens [beier90]. In South Carolina, daytime activity of bucks fell as it warmed in the breeding season and rose as it dropped below about 10 °C in the post-breeding season. Evening activity peaked around 15 to 21 °C. [goethlich19]
- Barometric pressure: the best predictor in that study was the change over the past four hours, not the reading itself, and its effects came and went with the season. Hunters say deer move ahead of a front and right after one; the research is mixed, so treat a falling barometer as a mild reason to be in the stand, not a promise. [goethlich19] [lit]
- Moon: hunters say bucks move by the moon. A GPS-collar study at southern latitudes found no effect of moon phase on daily, nighttime or daytime movement, and concluded that hourly and daily weather change had little effect compared with dawn-and-dusk routine. [webb10] The app tilts its numbers a hair toward night feeding on bright nights; that is a guess, not a finding, so do not lean on it.
- Bucks do not go fully nocturnal. In Mississippi GPS-collar work, about a third of buck movement in October and November happened in daylight, and over 40% during the rut, with bucks covering roughly 1,500 yards a day before the rut and over 2,000 in it. [msu20]
- Hunting pressure: heavy pressure pushes deer to thicker cover and more night movement [kilgo98], but at one lightly hunted Maryland farm, two weeks of hunting did not measurably change adult bucks' behavior; the drop in daytime movement there came from the post-breeding season. Pressure matters when it is heavy and constant. [karns08]
- Calls (Atkeson, Marchinton and Miller 1988): a grunt is brief (about 0.1 to 0.4 s) and low, used by both sexes and mostly by dominant deer to displace a subordinate. A bleat is moderate in pitch and tonal, a fawn's call for a doe that brings her to look, and it carries about 100 yards. A snort is an alarm. The grunt-snort-wheeze, a grunt, three snorts and a wheeze lasting up to about 3 seconds, is the most intense threat call, given between bucks in the breeding season. A hunter's snort-wheeze can pull a buck in or send a smaller one off; a lone snort will spook deer. Do not overcall: calling is a tool for the right moment, not the plan. [atkeson88] [lit]

RESPECT
- Cherokee tradition tells of Awi Usdi, the Little Deer, chief of the deer, who comes to the blood of every deer killed and asks whether the hunter asked pardon. A hunter who killed with respect was forgiven; one who did not was punished. The lesson Esau carries: take what you need, make the shot count, waste nothing. [mooney1900]
`.trim();

/** Estimated peak-breeding date. Override per state when the app knows better. */
export function defaultRutPeak(year: number, lat: number): { date: Date; confident: boolean } {
  // Most northern and midwestern breeding peaks fall around Nov 10-20.
  if (lat >= 35) return { date: new Date(Date.UTC(year, 10, 14)), confident: true };
  // The Deep South is all over the calendar; give a middling guess and say so.
  return { date: new Date(Date.UTC(year, 11, 1)), confident: false };
}

const DAY = 864e5;

export function whitetailPhase(at: Date, lat: number, rutPeak?: Date): SeasonPhase {
  const month = at.getUTCMonth();
  // Late winter through summer is the off-season, whatever the rut date.
  if (month >= 1 && month <= 6) {
    const id = month <= 2 ? "late winter" : month <= 4 ? "spring and fawning" : "summer";
    return { id, notes: OFF_SEASON[id]!, rutPeakConfident: true };
  }
  let peak = rutPeak;
  let confident = true;
  if (!peak) {
    // January belongs to the previous fall's season.
    const seasonYear = month === 0 ? at.getUTCFullYear() - 1 : at.getUTCFullYear();
    const guess = defaultRutPeak(seasonYear, lat);
    peak = guess.date;
    confident = guess.confident;
  }
  const d = (at.getTime() - peak.getTime()) / DAY;
  const id =
    d < -75 ? "summer" :
    d < -35 ? "early season" :
    d < -20 ? "october lull" :
    d < -8 ? "pre-rut" :
    d < -2 ? "seeking and chasing" :
    d < 8 ? "peak breeding" :
    d < 21 ? "post-rut" :
    d < 35 ? "second rut" :
    "late season";
  return { id, notes: PHASES[id] ?? OFF_SEASON[id]!, rutPeakConfident: confident, daysFromRutPeak: Math.round(d) };
}

const PHASES: Record<string, string> = {
  "early season": "Deer are still on a summer bed-to-feed pattern and fairly predictable. Bachelor groups of bucks are breaking up. Hunt the food in the evening and the edge of cover near it; acorns start dropping and white oaks pull deer into the timber.",
  "october lull": "Movement seems to drop: pressure has started, acorns let deer feed without leaving cover, and warm days push activity to night. Deer are still there. Hunt close to bedding on a good wind, and hunt the cold fronts.",
  "pre-rut": "Rubs and scrapes ramp up and mature bucks start moving more in daylight. Hunt scrape lines, rub lines and the transition between bedding and food. Cold mornings after a front are the days.",
  "seeking and chasing": "Bucks are cruising for the first hot does, often mid-day, downwind of doe bedding. Saddles, benches and funnels between doe bedding areas are where you want to be. Sit long.",
  "peak breeding": "Bucks are locked with does in small pockets of cover; sightings can drop and the action is unpredictable. Stay with doe groups and funnels; an all-day sit beats moving around. Bucks move far and odd.",
  "post-rut": "Bucks are worn down and go back to food and thick cover. They are wary and move late. Hunt the best food near secure bedding, especially in the evening, on cold days.",
  "second rut": "Unbred does and some doe fawns come into heat. Activity spikes briefly around the doe groups and food sources.",
  "late season": "Food and warmth rule. Deer bed on sunny south faces and in thermal cover and feed hard on whatever is left: standing corn or beans, brassicas, browse. Cold, clear afternoons after a front are when they move in daylight.",
};

const OFF_SEASON: Record<string, string> = {
  "late winter": "Season is over in most places. Deer conserve energy in thermal cover near food. Good time to walk the ground: trails and beds show in the snow, and bucks are shedding antlers.",
  "spring and fawning": "Does fawn in May and June in thick, grassy cover and stay tight. Bucks are growing antlers. Scout last fall's sign while the woods are open, then stay out of the bedding.",
  summer: "Bachelor groups of bucks feed in the open in the evenings. Good time to glass fields and plan stand sites and access routes before the leaves and the pressure come.",
};

/**
 * Rough 0-1 scores for the tapped spot, from terrain and conditions alone.
 * These are priors for Esau to weigh, and the offline read when there is no signal.
 */
export function whitetailScores(spot: SpotReading, cond: ConditionsReading, phase: SeasonPhase): SpotScores {
  const clamp = (x: number) => Math.max(0, Math.min(1, x));
  const cold = cond.tempF < 48;
  const aspect = spot.aspectDeg;
  // +1 for north faces, -1 for south faces.
  const northness = aspect === null ? 0 : Math.cos((aspect * Math.PI) / 180);

  let bed = 0.08;
  bed += cold ? -northness * 0.18 + 0.16 : northness * 0.22 + 0.08;
  if (spot.cover.woody) bed += 0.26;
  else if (spot.cover.code === 52) bed += 0.16;
  else if (spot.crop || spot.cover.code === 82 || spot.cover.code === 21 || spot.cover.code >= 22 && spot.cover.code <= 24) bed -= 0.18;
  if (spot.cover.code === 11) bed -= 0.4;
  bed += spot.canopy * 0.12;
  if (spot.slopeDeg >= 6 && spot.slopeDeg <= 24) bed += 0.1 - Math.abs(spot.slopeDeg - 14) * 0.006;
  if (spot.slopeDeg > 32) bed -= 0.28;
  if (["bench", "point"].includes(spot.landform)) bed += 0.14;
  if (spot.landform === "creek bottom" && !cold) bed += 0.04;
  const food = spot.nearestFoodYd;
  if (food !== null) bed += food < 50 ? 0.04 : food < 140 ? 0.12 : food < 380 ? 0.22 : food < 700 ? 0.1 : 0;

  let feed = 0;
  if (spot.crop) feed = 0.75;
  else if (spot.cover.code === 82) feed = 0.65;
  else if (spot.cover.code === 81 || spot.cover.code === 71) feed = 0.35;
  else if (spot.cover.code === 52) feed = 0.45; // browse
  else if (spot.cover.woody) feed = 0.25; // mast in the timber
  if (spot.nearestEdgeYd !== null && spot.nearestEdgeYd < 60) feed += 0.1;

  let travel = 0.15;
  if (spot.landform === "saddle") travel += 0.45;
  if (spot.landform === "bench") travel += 0.3;
  if (spot.landform === "draw") travel += 0.2;
  if (spot.nearestEdgeYd !== null && spot.nearestEdgeYd < 50) travel += 0.2;
  if (spot.slopeDeg > 30) travel -= 0.25;
  if (spot.cover.woody && spot.nearestFoodYd !== null && spot.nearestFoodYd < 300) travel += 0.1;
  if (["pre-rut", "seeking and chasing", "peak breeding"].includes(phase.id) && ["saddle", "bench", "point"].includes(spot.landform))
    travel += 0.1;

  return { bedding: clamp(bed), feeding: clamp(feed), travel: clamp(travel) };
}

export const whitetail: SpeciesBrain = {
  id: "whitetail",
  name: "whitetail deer",
  ready: true,
  nose: true,
  words: { bedding: "bed", feeding: "feed", travel: "walk through" },
  knowledge: WHITETAIL_KNOWLEDGE,
  sources: WHITETAIL_SOURCES,
  phase: whitetailPhase,
  scores: whitetailScores,
};
