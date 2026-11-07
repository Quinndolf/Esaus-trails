import { distanceM } from "./geo";
import type { EsauMark, LatLng, SpotQuery } from "./types";

/** A bed, food, trail or stand pin this close to something in the read is that thing. */
const SNAP_YD = 40;
/** A walk-in or stay-off pin may sit between features, but on the read ground and near the spot. */
const ROUTE_MAX_YD = 800;
const YD = 0.9144;

/** Every real place Esau was told about: the spot, the hunter, nearby features and sit spots. */
export function markAnchors(q: Pick<SpotQuery, "spot" | "hunter" | "sitSpots">, nearby: LatLng[]): LatLng[] {
  const out: LatLng[] = [{ lat: q.spot.lat, lng: q.spot.lng }];
  if (q.hunter) out.push({ lat: q.hunter.lat, lng: q.hunter.lng });
  for (const f of nearby) out.push({ lat: f.lat, lng: f.lng });
  for (const s of q.sitSpots ?? []) out.push({ lat: s.lat, lng: s.lng });
  return out;
}

/**
 * Keep Esau's map pins honest. Bed, food, trail and stand pins must be on a place from the read
 * (snapped onto it); walk-in and stay-off pins must be on the read ground near the spot. The rest are dropped,
 * so a made-up coordinate never lands on the hunter's map.
 */
export function anchorMarks(
  marks: EsauMark[],
  anchors: LatLng[],
  spot: LatLng,
  bounds: Box,
  /** The hunter's screen: no pin lands off it. */
  view?: Box,
): EsauMark[] {
  return place(marks, anchors, spot, bounds).filter((m) => !view || inBox(view, m));
}

type Box = { west: number; east: number; south: number; north: number };
const inBox = (b: Box, p: LatLng) => p.lat >= b.south && p.lat <= b.north && p.lng >= b.west && p.lng <= b.east;

function place(marks: EsauMark[], anchors: LatLng[], spot: LatLng, bounds: Box): EsauMark[] {
  const out: EsauMark[] = [];
  for (const m of marks) {
    if (!Number.isFinite(m.lat) || !Number.isFinite(m.lng)) continue;
    let best: LatLng | null = null;
    let bestM = Infinity;
    for (const a of anchors) {
      const d = distanceM(m, a);
      if (d < bestM) {
        bestM = d;
        best = a;
      }
    }
    if (best && bestM <= SNAP_YD * YD) {
      out.push({ ...m, lat: best.lat, lng: best.lng });
      continue;
    }
    if (m.kind === "approach" || m.kind === "avoid") {
      if (inBox(bounds, m) && distanceM(m, spot) <= ROUTE_MAX_YD * YD) out.push(m);
    }
  }
  return out;
}
