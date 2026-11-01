import { formatArea, formatDistance, formatDuration, pathLength, polygonArea, type LngLat } from '../map/geo';
import type { PhotoPin } from '../photos/types';
import type { Shape, Track, Waypoint, WaypointIcon } from '../tools/types';

export type MarkKind = 'waypoint' | 'photo' | 'track' | 'shape';
export type MarkFilter = 'all' | 'waypoint' | 'photo' | 'track';

export interface MarkItem {
  id: string;
  kind: MarkKind;
  title: string;
  subtitle: string;
  icon?: WaypointIcon;
  /** Where to jump to: one point for pins, the whole path for tracks and shapes. */
  points: LngLat[];
  createdAt: number;
  /** Lower-case text the search box looks in. */
  haystack: string;
}

const day = (t: number) => {
  const d = new Date(t);
  return d.toDateString() === new Date().toDateString() ? 'today' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export function buildMarks(src: { waypoints: Waypoint[]; pins: PhotoPin[]; tracks: Track[]; shapes: Shape[] }): MarkItem[] {
  const out: MarkItem[] = [];
  for (const w of src.waypoints) {
    const t = Date.parse(w.createdAt);
    out.push({
      id: w.id,
      kind: 'waypoint',
      title: w.name,
      subtitle: `Waypoint · ${day(t)}`,
      icon: w.icon,
      points: [w.position],
      createdAt: t,
      haystack: `${w.name} ${w.notes} ${w.icon}`.toLowerCase(),
    });
  }
  for (const p of src.pins) {
    const t = Date.parse(p.createdAt);
    out.push({
      id: p.id,
      kind: 'photo',
      title: p.name,
      subtitle: `Photo · ${day(t)}`,
      points: [[p.position.lng, p.position.lat]],
      createdAt: t,
      haystack: `${p.name} ${p.notes} ${p.tags.join(' ')}`.toLowerCase(),
    });
  }
  for (const k of src.tracks) {
    out.push({
      id: k.id,
      kind: 'track',
      title: k.name,
      subtitle: `Track · ${formatDistance(k.distance)} · ${formatDuration(k.endedAt - k.startedAt)}`,
      points: k.points.map((q) => q.lngLat),
      createdAt: k.startedAt,
      haystack: k.name.toLowerCase(),
    });
  }
  for (const s of src.shapes) {
    const t = Date.parse(s.createdAt);
    out.push({
      id: s.id,
      kind: 'shape',
      title: s.name,
      subtitle: `Shape · ${s.kind === 'area' ? formatArea(polygonArea(s.points)) : formatDistance(pathLength(s.points))}`,
      points: s.points,
      createdAt: t,
      haystack: `${s.name} ${s.notes}`.toLowerCase(),
    });
  }
  return out.sort((a, b) => b.createdAt - a.createdAt);
}

/** Shapes ride with the Tracks chip: both are lines and areas on the ground. */
export function filterMarks(items: MarkItem[], filter: MarkFilter, query: string): MarkItem[] {
  const q = query.trim().toLowerCase();
  return items.filter((m) => {
    const kindOk = filter === 'all' || m.kind === filter || (filter === 'track' && m.kind === 'shape');
    return kindOk && (!q || m.haystack.includes(q));
  });
}

export function countByKind(items: MarkItem[]): Record<MarkFilter, number> {
  const n = (f: MarkFilter) => filterMarks(items, f, '').length;
  return { all: items.length, waypoint: n('waypoint'), photo: n('photo'), track: n('track') };
}
