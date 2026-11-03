import { angleDiff, compassWord } from "../model/geo";
import type { PointReading } from "../model/conditions";
import type { SitSpot } from "../model/sitSpots";

export interface SpotWhyLine {
  label: string;
  text: string;
}

export interface SpotWhy {
  title: string;
  lines: SpotWhyLine[];
}

/** Scent this close to where you face counts as blowing toward the animal. */
const TOWARD_DEG = 60;

const TARGET: Record<NonNullable<SitSpot["kind"]>, string> = {
  trail: "the trail",
  food_trees: "the food trees",
  roost: "the opening they fly down to",
  strut_zone: "the woods they come out of",
};

/** Squirrel and turkey picks with nothing nearby to face carry bearing 0, which means "no direction", not north. */
const hasDirection = (s: SitSpot) => !s.kind || s.kind === "trail" || s.yardsToTrail > 0;
/** Only deer picks are built around keeping scent off the animal. */
const scentMatters = (s: SitSpot) => !s.kind || s.kind === "trail";
const yards = (n: number) => (n < 10 ? "a few yd" : `about ${Math.round(n / 10) * 10} yd`);

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function face(spot: SitSpot, target: string): string {
  if (!hasDirection(spot)) return spot.kind === "food_trees" ? "You're in the food trees. Watch all around you." : "Face the side with the most open view.";
  const far = spot.yardsToTrail > 0 ? ` about ${spot.yardsToTrail} yd out` : "";
  return `Face ${compassWord(spot.watchBearingDeg)}, toward ${target}${far}.`;
}

function scent(spot: SitSpot, r: PointReading): string {
  if (r.scent.driver === "swirling") {
    return `${r.wind.line} Your scent swirls here and can go any way, so stay still and keep it short.`;
  }
  const drift = `Your scent drifts ${compassWord(r.scent.towardDeg)} ${yards(r.scent.reachYards)}`;
  if (spot.kind === "roost" || spot.kind === "strut_zone") return `${r.wind.line} ${drift}. Turkeys go by eyesight, not smell, so staying still matters more than the wind.`;
  if (!scentMatters(spot) || !hasDirection(spot)) return `${r.wind.line} ${drift}. Squirrels go by sight and sound more than smell, so move slow and stay still.`;
  const off = angleDiff(r.scent.towardDeg, spot.watchBearingDeg);
  const verdict =
    off <= TOWARD_DEG
      ? "That is toward where you'll be watching, so this spot is weak this hour. Try another hour or spot."
      : off < 180 - TOWARD_DEG
        ? "That is off to the side of where you'll be watching. Fine if the wind holds steady."
        : "That is away from where you'll be watching, which is why it works.";
  return `${r.wind.line} ${drift}. ${verdict}`;
}

function air(r: PointReading): string {
  switch (r.thermal.state) {
    case "Rising":
      return "Warm air is rising uphill now, so your scent lifts up the slope. Animals below you are less likely to smell you.";
    case "Sinking":
      return "Cool air is sliding downhill now, so your scent flows down onto lower ground. Don't sit above where animals travel; sit level with or below them.";
    case "Pooling":
      return "Cool air is pooling in low ground now, so scent sits and spreads in the bottoms.";
    default:
      return "Air isn't sliding along the ground now, so the wind is what carries your scent.";
  }
}

function ground(r: PointReading): string {
  const slope = r.slopeDeg != null ? `, ${r.slopeDeg}° slope${r.facing != null ? ` facing ${compassWord(r.facing)}` : ""}` : "";
  const elev = r.elevationFt != null ? `, about ${r.elevationFt} ft` : "";
  return `${cap(r.terrainWord)}${slope}${elev}.`;
}

function walkIn(spot: SitSpot): string {
  const behind = compassWord(spot.watchBearingDeg + 180);
  switch (spot.kind) {
    case "food_trees":
      return `Walk in slow and quiet${hasDirection(spot) ? ` from the ${behind}` : ""}, stopping often. Squirrels hear and see you long before you see them.`;
    case "roost":
      return `Slip in before light${hasDirection(spot) ? ` from the ${behind} side` : ""}, and never walk under the roost.`;
    case "strut_zone":
      return "Come in along the edge of the woods before birds reach the opening, and never walk across the open ground.";
    default:
      return `Come in from the ${behind}, behind where you'll face, so you never cross the trail. Be settled before deer move.`;
  }
}

function rank(spot: SitSpot): string {
  if (spot.rank === 1) return "Esau's strongest pick for this hour.";
  return `About ${Math.max(10, Math.round(spot.score * 10) * 10)}% as strong as spot 1 this hour.`;
}

/**
 * Why Esau picked a sit spot, as short teaching lines for a beginner.
 * Pure. Reads only the spot and the land/wind/weather reading for that hour.
 * With no reading (the spot is off the read ground) it gives only what the pick itself says.
 */
export function spotWhy(spot: SitSpot, reading: PointReading | null): SpotWhy {
  const target = TARGET[spot.kind ?? "trail"];
  const lines: SpotWhyLine[] = [
    { label: "Why here", text: spot.reason },
    { label: "Face", text: face(spot, target) },
  ];
  if (reading?.inGrid) {
    lines.push(
      { label: "Wind and scent", text: scent(spot, reading) },
      { label: "Air movement", text: air(reading) },
      { label: "Ground", text: ground(reading) },
    );
  }
  lines.push({ label: "Walk in", text: walkIn(spot) }, { label: "Rank", text: rank(spot) });
  return { title: `Why spot ${spot.rank}`, lines };
}
