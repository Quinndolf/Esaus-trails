import { angleDelta, distance, normalizeBearing, type LngLat } from "../map/geo";
import type { Track } from "../tools/types";

const YD_PER_M = 1.09361;
/** A jump faster than this is a GPS glitch, not a hunter. */
const MAX_SPEED_MPS = 10;
const SIT_RADIUS_YD = 15;
const SIT_MIN_MIN = 5;
/** A bed or trail this close and downwind of a step counts as crossed by scent. */
export const SCENT_RANGE_YD = 150;
const SCENT_CONE_DEG = 30;

export interface Sit {
  lngLat: LngLat;
  minutes: number;
  start: number;
}
export interface Analysis {
  distanceYd: number;
  durationMin: number;
  sits: Sit[];
}
export interface Crossing {
  at: number;
  lngLat: LngLat;
  what: "bed" | "trail";
  yards: number;
}

const timed = (t: number) => Number.isFinite(t);

export function analyzeTrack(track: Track): Analysis {
  const pts = track.points.filter((p) => p.lngLat.every(Number.isFinite));
  let meters = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!, b = pts[i]!;
    const d = distance(a.lngLat, b.lngLat);
    const dt = timed(a.time) && timed(b.time) ? (b.time - a.time) / 1000 : NaN;
    if (Number.isFinite(dt) && dt > 0 && d / dt > MAX_SPEED_MPS) continue;
    if (Number.isFinite(dt) && dt <= 0 && d > 5) continue;
    meters += d;
  }
  const first = pts.find((p) => timed(p.time)), last = [...pts].reverse().find((p) => timed(p.time));
  const durationMin = first && last && last.time > first.time ? (last.time - first.time) / 60000 : 0;
  return { distanceYd: meters * YD_PER_M, durationMin, sits: findSits(pts) };
}

function findSits(pts: Track["points"]): Sit[] {
  const sits: Sit[] = [];
  let i = 0;
  while (i < pts.length) {
    const anchor = pts[i]!;
    if (!timed(anchor.time)) { i++; continue; }
    let j = i;
    while (j + 1 < pts.length && timed(pts[j + 1]!.time) && distance(anchor.lngLat, pts[j + 1]!.lngLat) * YD_PER_M <= SIT_RADIUS_YD) j++;
    const minutes = (pts[j]!.time - anchor.time) / 60000;
    if (minutes >= SIT_MIN_MIN) {
      sits.push({ lngLat: anchor.lngLat, minutes, start: anchor.time });
      i = j + 1;
    } else i++;
  }
  return sits;
}

function bearing([lng1, lat1]: LngLat, [lng2, lat2]: LngLat): number {
  const r = Math.PI / 180;
  const y = Math.sin((lng2 - lng1) * r) * Math.cos(lat2 * r);
  const x = Math.cos(lat1 * r) * Math.sin(lat2 * r) - Math.sin(lat1 * r) * Math.cos(lat2 * r) * Math.cos((lng2 - lng1) * r);
  return normalizeBearing(Math.atan2(y, x) / r);
}

/** Places where the hunter's scent blew toward a known bed or trail within range. One crossing per target. */
export function scentCrossings(
  track: Track,
  a: { windFromDeg: (lngLat: LngLat, at: number) => number; beds: LngLat[]; trails: LngLat[] },
): Crossing[] {
  const out: Crossing[] = [];
  const seen = new Set<string>();
  const targets: { p: LngLat; what: Crossing["what"] }[] = [...a.beds.map((p) => ({ p, what: "bed" as const })), ...a.trails.map((p) => ({ p, what: "trail" as const }))];
  for (const step of track.points) {
    if (!step.lngLat.every(Number.isFinite)) continue;
    const toward = normalizeBearing(a.windFromDeg(step.lngLat, step.time) + 180);
    for (const t of targets) {
      const key = `${t.what}:${t.p[0]},${t.p[1]}`;
      if (seen.has(key)) continue;
      const yards = distance(step.lngLat, t.p) * YD_PER_M;
      if (yards > SCENT_RANGE_YD) continue;
      if (Math.abs(angleDelta(toward, bearing(step.lngLat, t.p))) > SCENT_CONE_DEG) continue;
      seen.add(key);
      out.push({ at: step.time, lngLat: step.lngLat, what: t.what, yards: Math.round(yards) });
    }
  }
  return out;
}
