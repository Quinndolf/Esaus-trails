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
  bounds: { west: number; east: number; south: number; north: number },
): EsauMark[] {
  const out: EsauMark[] = [];
  for (const m of marks) {
    if (!Number.isFinite(m.lat) || !Number.isFinite(m.lng)) continue;
    if (m.kind === "approach" || m.kind === "avoid") {
      const onGround = m.lat >= bounds.south && m.lat <= bounds.north && m.lng >= bounds.west && m.lng <= bounds.east;
      if (onGround && distanceM(m, spot) <= ROUTE_MAX_YD * YD) out.push(m);
      continue;
    }
    let best: LatLng | null = null;
    let bestM = Infinity;
    for (const a of anchors) {
      const d = distanceM(m, a);
      if (d < bestM) {
        bestM = d;
        best = a;
      }
    }
    if (best && bestM <= SNAP_YD * YD) out.push({ ...m, lat: best.lat, lng: best.lng });
  }
  return out;
}
