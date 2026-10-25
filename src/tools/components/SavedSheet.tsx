import { useState } from 'react';
import type { Map as MLMap } from 'maplibre-gl';
import { formatArea, formatDistance, formatDuration, pathLength, polygonArea, type LngLat } from '../../map/geo';
import { BottomSheet } from '../../ui/BottomSheet';
import { TrashIcon } from '../../ui/icons';
import { ICON_COLORS, iconSvg } from '../icons';
import { useTools } from '../store';

type Tab = 'waypoints' | 'shapes' | 'tracks';

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

/** Everything the hunter has saved: waypoints, drawn shapes and recorded tracks. */
export function SavedSheet({ open, onClose, map }: { open: boolean; onClose: () => void; map: MLMap | null }) {
  const [tab, setTab] = useState<Tab>('waypoints');
  const { waypoints, shapes, tracks } = useTools();
  const { selectWaypoint, removeShape, removeTrack } = useTools.getState();

  return (
    <BottomSheet title="Saved" open={open} onClose={onClose}>
      <div className="segmented three" role="tablist">
        {(['waypoints', 'shapes', 'tracks'] as Tab[]).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'is-active' : ''} onClick={() => setTab(t)}>
            {t === 'waypoints' ? `Waypoints (${waypoints.length})` : t === 'shapes' ? `Shapes (${shapes.length})` : `Tracks (${tracks.length})`}
          </button>
        ))}
      </div>

      {tab === 'waypoints' && (
        <ul className="area-list">
          {!waypoints.length && <p className="hint">Use Mark my location or Drop waypoint from Tools.</p>}
          {waypoints.map((w) => (
            <li key={w.id} className="area-row">
              <span className="wp-list-icon" style={{ ['--wp-color' as string]: ICON_COLORS[w.icon] }} dangerouslySetInnerHTML={{ __html: iconSvg(w.icon) }} />
              <button
                className="area-main"
                onClick={() => {
                  fitTo(map, [w.position]);
                  onClose();
                  selectWaypoint(w.id);
                }}
              >
                <strong>{w.name}</strong>
                <span>
                  {new Date(w.createdAt).toLocaleDateString()}
                  {w.photoIds.length ? ` · ${w.photoIds.length} photo${w.photoIds.length > 1 ? 's' : ''}` : ''}
                  {w.notes ? ` · ${w.notes.slice(0, 40)}` : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {tab === 'shapes' && (
        <ul className="area-list">
          {!shapes.length && <p className="hint">Use Draw line or Draw area from Tools.</p>}
          {shapes.map((s) => (
            <li key={s.id} className="area-row">
              <button
                className="area-main"
                onClick={() => {
                  fitTo(map, s.points);
                  onClose();
                }}
              >
                <strong>{s.name}</strong>
                <span>{s.kind === 'area' ? formatArea(polygonArea(s.points)) : formatDistance(pathLength(s.points))}</span>
              </button>
              <button className="icon-btn" aria-label={`Delete ${s.name}`} onClick={() => void removeShape(s.id)}>
                <TrashIcon />
              </button>
            </li>
          ))}
        </ul>
      )}

      {tab === 'tracks' && (
        <ul className="area-list">
          {!tracks.length && <p className="hint">Start the Tracker from Tools to record your route.</p>}
          {tracks.map((t) => (
            <li key={t.id} className="area-row">
              <button
                className="area-main"
                onClick={() => {
                  fitTo(map, t.points.map((p) => p.lngLat));
                  onClose();
                }}
              >
                <strong>{t.name}</strong>
                <span>
                  {formatDistance(t.distance)} · {formatDuration(t.endedAt - t.startedAt)}
                </span>
              </button>
              <button className="icon-btn" aria-label={`Delete ${t.name}`} onClick={() => void removeTrack(t.id)}>
                <TrashIcon />
              </button>
            </li>
          ))}
        </ul>
      )}
    </BottomSheet>
  );
}
