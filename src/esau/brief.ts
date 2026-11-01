import { localTime, readConditions, type ThermalFn } from "./conditions";
import { compass } from "./geo";
import { buildSystemPrompt } from "./persona";
import { deerPredictionLines } from "../model/deerRead";
import { atmosphereForGrid, modelThermal } from "../model/esau";
import { speciesBrain } from "./species";
import type { SeasonPhase, SpeciesBrain, SpotScores } from "./species/types";
import { readSpot } from "./terrain";
import type { ConditionsReading, SpotQuery, SpotReading } from "./types";

export interface EsauBrief {
  species: SpeciesBrain;
  /** Byte-stable per species, so the API can cache it. */
  system: string;
  /** The field report for this tap. */
  report: string;
  spot: SpotReading;
  conditions: ConditionsReading;
  phase: SeasonPhase;
  scores: SpotScores;
}

export class EsauInputError extends Error {}

const r5 = (x: number) => Math.round(x * 1e5) / 1e5;
const pct = (x: number) => `${Math.round(x * 100)}%`;

/**
 * Turn a tap into what Esau needs to hear: one field report covering position, terrain and air.
 * Pure and synchronous, so the app can also use the readings directly (and offline).
 */
export function buildBrief(q: SpotQuery, opts: { thermal?: ThermalFn; rutPeak?: Date } = {}): EsauBrief {
  const species = speciesBrain(q.species);
  if (!species || !species.ready) throw new EsauInputError(`Esau hasn't studied ${q.species} yet`);
  const g = q.grid;
  if (!g || !g.cols || !g.rows || g.elevationM?.length !== g.cols * g.rows) throw new EsauInputError("grid is missing or malformed");
  if (!g.weather?.hours?.length) throw new EsauInputError("grid has no weather hours");

  const spot = readSpot(g, q.spot, { hunter: q.hunter });
  // The wind and thermal module's model by default; tests can pass the prototype rules.
  const conditions = readConditions(g, q.spot, q.hourIndex ?? 0, { timeZone: q.timeZone, thermal: opts.thermal ?? modelThermal });
  const phase = species.phase(new Date(conditions.at), q.spot.lat, opts.rutPeak);
  const scores = species.scores(spot, conditions, phase);

  const lines: string[] = [];
  lines.push(`FIELD REPORT — ${species.name}`);
  lines.push(`Time: ${conditions.localTime} (sun ${conditions.sun.phase}, ${conditions.sun.altitudeDeg}° up)`);
  lines.push(
    `Season: ${phase.id}${phase.daysFromRutPeak !== undefined ? ` (${Math.abs(phase.daysFromRutPeak)} days ${phase.daysFromRutPeak < 0 ? "before" : "after"} estimated peak breeding${phase.rutPeakConfident ? "" : ", and that date is a rough guess for this latitude"})` : ""}. ${phase.notes}`,
  );

  lines.push("");
  lines.push("POSITION");
  lines.push(`Tapped spot: ${r5(q.spot.lat)}, ${r5(q.spot.lng)}`);
  if (q.hunter && spot.fromHunter) {
    const h = spot.fromHunter;
    lines.push(
      `Hunter (GPS${q.hunter.accuracyM ? ` ±${Math.round(q.hunter.accuracyM / 0.9144)} yd` : ""}): ${r5(q.hunter.lat)}, ${r5(q.hunter.lng)}. The spot is ${h.yards} yd ${h.compass} of the hunter, ${h.climbFt === 0 ? "level" : h.climbFt > 0 ? `${h.climbFt} ft uphill` : `${-h.climbFt} ft downhill`}.${q.hunter.headingDeg !== undefined ? ` Hunter is facing ${Math.round(q.hunter.headingDeg)}°.` : ""}`,
    );
  } else {
    lines.push("Hunter's GPS position: unknown (they may be planning from home).");
  }
  if (q.layersHere?.length) lines.push(`Map layers here: ${q.layersHere.join("; ")}`);

  lines.push("");
  lines.push("TERRAIN AT THE SPOT");
  lines.push(
    `${spot.landform}, ${spot.elevationFt} ft, ${spot.slopeDeg}° slope${spot.aspectName ? `, ${spot.aspectName}` : ""}, ${spot.reliefFt >= 0 ? `${spot.reliefFt} ft above` : `${-spot.reliefFt} ft below`} the surrounding ground.`,
  );
  lines.push(`Cover: ${spot.cover.name}${spot.crop ? `, crop: ${spot.crop.name}` : ""}; canopy about ${pct(spot.canopy)}.`);
  const near = (yd: number | null, what: string) => (yd === null ? `no ${what} on this map` : yd === 0 ? `${what} right here` : `${what} ${yd} yd`);
  lines.push(
    `Nearest: ${near(spot.nearestFoodYd, "food")}${spot.nearestFoodWhat && spot.nearestFoodYd ? ` (${spot.nearestFoodWhat})` : ""}; ${near(spot.nearestWaterYd, "water")}; ${near(spot.nearestEdgeYd, "cover edge")}.`,
  );
  if (spot.nearby.length) {
    lines.push("Nearby:");
    for (const f of spot.nearby.slice(0, 10)) lines.push(`- ${f.label}, ${f.yards} yd ${f.compass} at ${r5(f.lat)}, ${r5(f.lng)}`);
  }

  lines.push("");
  lines.push("AIR");
  if (species.plant) lines.push(`${conditions.tempF}°F. Wind and thermals do not matter to a plant; do not talk about scent.`);
  else {
    lines.push(
      `Wind ${conditions.windMph} mph from the ${conditions.windFromCompass}${conditions.gustMph ? `, gusting ${Math.round(conditions.gustMph)}` : ""}; scent carries toward the ${conditions.scentTowardCompass}. ${conditions.tempF}°F.`,
    );
    lines.push(`Thermal on this slope: ${conditions.thermal.state}. ${conditions.thermal.plain}`);
  }
  if (!species.plant)
  try {
    const atmo = atmosphereForGrid(g, new Date(conditions.at));
    conditions.atmosphere = atmo.line;
    lines.push(`Weather pattern: ${atmo.line}`);
  } catch {
    // No usable forecast hours around this time; the wind and thermal lines stand alone.
  }
  if (!species.plant && spot.fromHunter && conditions.windMph >= 2) {
    const towardSpot = Math.abs(((spot.fromHunter.bearingDeg - conditions.scentToward + 540) % 360) - 180) <= 42;
    lines.push(towardSpot ? "The hunter's scent is blowing toward the tapped spot." : "The hunter's scent is not blowing toward the tapped spot.");
    if (!species.nose && !species.plant) lines.push(`A ${species.name} doesn't hunt by nose, so scent hardly matters; sound and movement do.`);
  }
  if (!species.plant && conditions.outlook.length) {
    lines.push(
      "Next hours: " +
        conditions.outlook.map((o) => `${o.localTime.replace(/^\w+, \w+ \d+, /, "")} ${o.windMph} mph ${o.windFromCompass}, ${o.thermal}`).join("; "),
    );
  }

  if (species.id === "whitetail") {
    const pred = deerPredictionLines(g, [q.spot.lng, q.spot.lat], new Date(conditions.at));
    if (pred.length) lines.push("", ...pred);
  }

  lines.push("");
  if (species.report) lines.push(...species.report(spot, conditions, phase, new Date(conditions.at)));
  else lines.push(`ROUGH SCORES (simple rules, weigh them, don't trust them): bedding ${pct(scores.bedding)}, feeding ${pct(scores.feeding)}, travel ${pct(scores.travel)}.`);
  if (g.notes?.length) lines.push(`Data notes: ${g.notes.join(" ")}`);

  if (q.history?.length) {
    lines.push("");
    lines.push("EARLIER ABOUT THIS SPOT:");
    for (const t of q.history.slice(-8)) lines.push(`${t.role === "hunter" ? "Hunter" : "Esau"}: ${t.text.trim()}`);
  }

  lines.push("");
  lines.push(
    q.question?.trim()
      ? `THE HUNTER ASKS: ${q.question.trim()}`
      : `The hunter tapped this spot and wants your full read of this area, for the ${species.name} only. Cover the terrain, the wind and the thermal at this hour, and how a ${species.name} would use this ground now, then say what you'd do about it. Say nothing about any other animal.`,
  );

  return { species, system: buildSystemPrompt(species), report: lines.join("\n"), spot, conditions, phase, scores };
}
