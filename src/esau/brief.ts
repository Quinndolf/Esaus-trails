import { localTime, readConditions, type ThermalFn } from "./conditions";
import { compass } from "./geo";
import { buildSystemPrompt } from "./persona";
import { modelThermal } from "../model/esau";
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

  const spot = readSpot(g, q.spot, { hunter: q.hunter, pins: q.pins });
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
  lines.push(
    `Wind ${conditions.windMph} mph from the ${conditions.windFromCompass}${conditions.gustMph ? `, gusting ${Math.round(conditions.gustMph)}` : ""}; scent carries toward the ${conditions.scentTowardCompass}. ${conditions.tempF}°F.`,
  );
  lines.push(`Thermal on this slope: ${conditions.thermal.state}. ${conditions.thermal.plain}`);
  if (spot.fromHunter && conditions.windMph >= 2) {
    const towardSpot = Math.abs(((spot.fromHunter.bearingDeg - conditions.scentToward + 540) % 360) - 180) <= 42;
    lines.push(towardSpot ? "The hunter's scent is blowing toward the tapped spot." : "The hunter's scent is not blowing toward the tapped spot.");
    if (!species.nose) lines.push(`A ${species.name} doesn't hunt by nose, so scent hardly matters; sound and movement do.`);
  }
  if (conditions.outlook.length) {
    lines.push(
      "Next hours: " +
        conditions.outlook.map((o) => `${o.localTime.replace(/^\w+, \w+ \d+, /, "")} ${o.windMph} mph ${o.windFromCompass}, ${o.thermal}`).join("; "),
    );
  }

  lines.push("");
  lines.push(`ROUGH SCORES (simple rules, weigh them, don't trust them): bedding ${pct(scores.bedding)}, feeding ${pct(scores.feeding)}, travel ${pct(scores.travel)}.`);
  if (g.notes?.length) lines.push(`Data notes: ${g.notes.join(" ")}`);

  if (q.photo) {
    const ph = q.photo;
    lines.push("");
    lines.push("PHOTO");
    if (!ph.image) lines.push("The hunter tried to show you a photo, but it could not be read on their phone. You cannot see it; say so.");
    else lines.push("The hunter attached a photo taken at this spot (above). Read it together with the ground.");
    const facts: string[] = [];
    if (ph.name) facts.push(`named "${ph.name}"`);
    if (ph.takenAt) facts.push(`taken ${localTime(ph.takenAt, q.timeZone)}`);
    if (ph.headingDeg != null) facts.push(`camera facing ${compass(ph.headingDeg)}`);
    if (ph.tags?.length) facts.push(`tagged ${ph.tags.join(", ")}`);
    if (ph.notes) facts.push(`hunter's notes: "${ph.notes}"`);
    if (facts.length) lines.push(`Photo details: ${facts.join("; ")}.`);
    if (ph.locationSource === "manual") lines.push("The hunter placed this pin by hand, so the spot may be off by some distance.");
    else if (ph.locationSource === "exif") lines.push("The location came from the photo's own GPS data.");
  }

  if (q.history?.length) {
    lines.push("");
    lines.push("EARLIER ABOUT THIS SPOT:");
    for (const t of q.history.slice(-8)) lines.push(`${t.role === "hunter" ? "Hunter" : "Esau"}: ${t.text.trim()}`);
  }

  lines.push("");
  lines.push(
    q.question?.trim()
      ? `THE HUNTER ASKS: ${q.question.trim()}`
      : "The hunter tapped this spot. Tell them what it is to the animal right now and what you'd do about it.",
  );

  return { species, system: buildSystemPrompt(species), report: lines.join("\n"), spot, conditions, phase, scores };
}
