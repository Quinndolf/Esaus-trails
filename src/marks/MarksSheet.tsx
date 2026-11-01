import { useMemo, useRef, useState } from 'react';
import type { Map as MLMap } from 'maplibre-gl';
import type { LngLat } from '../map/geo';
import { usePhotoPins } from '../photos/store';
import { ICON_COLORS, iconSvg } from '../tools/icons';
import { useTools } from '../tools/store';
import { BottomSheet } from '../ui/BottomSheet';
import { TrashIcon } from '../ui/icons';
import { buildMarks, countByKind, filterMarks, type MarkFilter, type MarkItem } from './model';
import { useUndoDeletes } from './undo';
import './marks.css';

const SWIPE_PX = 80;
const FILTERS: { id: MarkFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'waypoint', label: 'Waypoints' },
  { id: 'photo', label: 'Photos' },
  { id: 'track', label: 'Tracks' },
];

function fitTo(map: MLMap | null, points: LngLat[]) {
  if (!map || !points.length) return;
  const lngs = points.map((p) => p[0]);
  const lats = points.map((p) => p[1]);
  const h = map.getContainer().clientHeight;
  map.fitBounds(
    [
      [Math.min(...lngs), Math.min(...lats)],
      [Math.max(...lngs), Math.max(...lats)],
    ],
    { padding: { top: 60, left: 40, right: 40, bottom: Math.min(h * 0.5, 400) }, maxZoom: 17 },
  );
}

/** Deletes the real record once the undo window runs out. */
function commitDelete(m: MarkItem): () => Promise<void> {
  if (m.kind === 'waypoint') return () => useTools.getState().removeWaypoint(m.id);
  if (m.kind === 'photo') return () => usePhotoPins.getState().removePin(m.id);
  if (m.kind === 'track') return () => useTools.getState().removeTrack(m.id);
  return () => useTools.getState().removeShape(m.id);
}

export function deleteMark(m: MarkItem) {
  useUndoDeletes.getState().schedule(m.id, m.title, commitDelete(m));
}

function Glyph({ m }: { m: MarkItem }) {
  if (m.kind === 'waypoint' && m.icon)
    return <span className="mark-glyph" style={{ ['--wp-color' as string]: ICON_COLORS[m.icon] }} dangerouslySetInnerHTML={{ __html: iconSvg(m.icon) }} />;
  return (
    <span className="mark-glyph" aria-hidden>
      {m.kind === 'photo' ? '📷' : m.kind === 'track' ? '〰' : '⬠'}
    </span>
  );
}

function Row({ m, onOpen }: { m: MarkItem; onOpen: () => void }) {
  const [dx, setDx] = useState(0);
  const start = useRef<{ x: number; id: number } | null>(null);
  const moved = useRef(false);
  return (
    <li className="mark-row" data-testid={`mark-${m.id}`}>
      <div className="mark-delete-bg" aria-hidden>
        Delete
      </div>
      <div
        className="mark-row-main"
        style={{ transform: `translateX(${dx}px)`, transition: start.current ? 'none' : 'transform .15s' }}
        onPointerDown={(e) => {
          start.current = { x: e.clientX, id: e.pointerId };
          moved.current = false;
        }}
        onPointerMove={(e) => {
          if (!start.current) return;
          const d = e.clientX - start.current.x;
          if (Math.abs(d) > 6) moved.current = true;
          if (moved.current) setDx(Math.min(0, d));
        }}
        onPointerUp={() => {
          const swiped = dx <= -SWIPE_PX;
          start.current = null;
          setDx(0);
          if (swiped) deleteMark(m);
        }}
        onPointerCancel={() => {
          start.current = null;
          setDx(0);
        }}
      >
        <Glyph m={m} />
        <button
          className="mark-open"
          onClick={() => {
            if (!moved.current) onOpen();
          }}
        >
          <strong>{m.title}</strong>
          <span>{m.subtitle}</span>
        </button>
        <button className="icon-btn" aria-label={`Delete ${m.title}`} data-testid={`mark-del-${m.id}`} onClick={() => deleteMark(m)}>
          <TrashIcon />
        </button>
      </div>
    </li>
  );
}

/** Everything the hunter has placed or recorded, in one searchable list. All of it lives on this phone. */
export function MarksSheet({ open, onClose, map }: { open: boolean; onClose: () => void; map: MLMap | null }) {
  const [filter, setFilter] = useState<MarkFilter>('all');
  const [query, setQuery] = useState('');
  const waypoints = useTools((s) => s.waypoints);
  const shapes = useTools((s) => s.shapes);
  const tracks = useTools((s) => s.tracks);
  const pins = usePhotoPins((s) => s.pins);
  const hidden = useUndoDeletes((s) => s.pending);

  const all = useMemo(() => buildMarks({ waypoints, pins, tracks, shapes }).filter((m) => !hidden[m.id]), [waypoints, pins, tracks, shapes, hidden]);
  const counts = countByKind(all);
  const shown = filterMarks(all, filter, query);

  const jump = (m: MarkItem) => {
    fitTo(map, m.points);
    onClose();
    if (m.kind === 'waypoint') useTools.getState().selectWaypoint(m.id);
    if (m.kind === 'photo') usePhotoPins.getState().select(m.id);
  };

  return (
    <BottomSheet title="My Marks" open={open} onClose={onClose}>
      <input className="text-input" type="search" placeholder="Search" aria-label="Search marks" value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="mark-chips" role="tablist">
        {FILTERS.map((f) => (
          <button key={f.id} role="tab" aria-selected={filter === f.id} className={`mark-chip ${filter === f.id ? 'is-active' : ''}`} onClick={() => setFilter(f.id)}>
            {f.label}
            {f.id === 'all' ? ` ${counts.all}` : ''}
          </button>
        ))}
      </div>
      <ul className="area-list">
        {shown.map((m) => (
          <Row key={m.id} m={m} onOpen={() => jump(m)} />
        ))}
      </ul>
      {!shown.length && <p className="hint">{all.length ? 'Nothing matches.' : 'Marks, photos, tracks and shapes you make will show up here.'}</p>}
      <p className="hint">
        Tap a row to jump to it on the map. Swipe left to delete (you get 5 seconds to undo). On the map, press and hold a marker, then drag it to fix its spot.
        Everything stays on this phone.
      </p>
    </BottomSheet>
  );
}

/** Shown after a delete, wherever the hunter is, for the 5 second undo window. */
export function UndoToast() {
  const pending = useUndoDeletes((s) => s.pending);
  const ids = Object.keys(pending);
  if (!ids.length) return null;
  const id = ids[ids.length - 1];
  return (
    <div className="undo-toast" role="status" data-testid="undo-toast">
      <span>Deleted “{pending[id].title}”</span>
      <button className="link-btn" onClick={() => useUndoDeletes.getState().undo(id)}>
        Undo
      </button>
    </div>
  );
}
