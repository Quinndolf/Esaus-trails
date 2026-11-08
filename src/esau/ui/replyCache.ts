import { yardsBetween } from '../../model/geo';
import type { EsauReply, LatLng, SpotQuery } from '../types';

/**
 * Answers kept on the phone so a repeat tap on the same spot is instant and spends no call.
 * Only plain reads (no question, no follow-up) are kept, and only Claude's own answers:
 * an offline fallback is never kept, so the next tap tries the server again.
 * Nothing leaves the phone; the cache lives in memory and is gone when the app closes.
 */

/** How long an answer is reused. */
export const REUSE_MS = 30 * 60_000;
/** A tap this close to an earlier one counts as the same spot. */
const NEAR_YD = 30;
const MAX = 20;

interface Kept {
  key: string;
  spot: LatLng;
  hunter: LatLng | null;
  at: number;
  reply: EsauReply;
}

let kept: Kept[] = [];

/** Everything an answer depends on except the tapped spot and the hunter, which are matched by distance. */
function keyOf(q: SpotQuery): string {
  const g = q.grid;
  return JSON.stringify([
    q.species,
    q.weapon ?? null,
    q.setup ?? null,
    g.weather.hours[q.hourIndex ?? 0] ?? q.hourIndex ?? 0,
    g.notes ?? null,
    [g.west, g.south, g.east, g.north].map((v) => v.toFixed(4)),
    q.timeZone,
    q.sitSpots ?? null,
    q.sitUnsure ?? null,
    q.verdict ?? null,
    q.layersHere ?? null,
    q.view ? [q.view.west, q.view.south, q.view.east, q.view.north].map((v) => v.toFixed(4)) : null,
    // Esau is told which way the hunter faces and how good the GPS fix is.
    q.hunter?.headingDeg == null ? null : Math.round(q.hunter.headingDeg / 45) % 8,
    q.hunter?.accuracyM == null ? null : Math.round(q.hunter.accuracyM / 10),
  ]);
}

const near = (a: LatLng, b: LatLng) => yardsBetween([a.lng, a.lat], [b.lng, b.lat]) <= NEAR_YD;
const sameHunter = (a: LatLng | null, b: LatLng | null) => (a && b ? near(a, b) : a === b);
const plain = (q: SpotQuery) => !q.question && !q.history?.length;

export function recallReply(q: SpotQuery, now = Date.now()): EsauReply | null {
  if (!plain(q)) return null;
  const key = keyOf(q);
  const hunter = q.hunter ?? null;
  const hit = kept.find((k) => k.key === key && now - k.at <= REUSE_MS && near(k.spot, q.spot) && sameHunter(k.hunter, hunter));
  return hit?.reply ?? null;
}

export function rememberReply(q: SpotQuery, reply: EsauReply, now = Date.now()): void {
  if (!plain(q) || reply.meta.servedBy === 'offline-rules') return;
  kept = [{ key: keyOf(q), spot: q.spot, hunter: q.hunter ?? null, at: now, reply }, ...kept.filter((k) => now - k.at <= REUSE_MS)].slice(0, MAX);
}

export function clearReplies(): void {
  kept = [];
}
