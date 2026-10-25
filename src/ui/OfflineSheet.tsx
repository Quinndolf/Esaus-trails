import { useEffect, useRef, useState } from 'react';
import type { Map as MLMap } from 'maplibre-gl';
import { BASEMAP_LABELS, type BasemapId } from '../map/basemaps';
import { MAX_TILES, deleteArea, estimate, listAreas, saveArea, type DownloadProgress, type SavedArea } from '../offline/store';
import type { Bounds } from '../offline/tiles';
import { BottomSheet } from './BottomSheet';
import { TrashIcon } from './icons';

const DETAIL = [
  { id: 'low', label: 'Low', maxZoom: 14 },
  { id: 'medium', label: 'Medium', maxZoom: 15 },
  { id: 'high', label: 'High', maxZoom: 16 },
  { id: 'max', label: 'Max', maxZoom: 17 },
] as const;

interface Props {
  open: boolean;
  onClose: () => void;
  map: MLMap | null;
  basemap: BasemapId;
}

function viewBounds(map: MLMap): Bounds {
  const b = map.getBounds();
  return { west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() };
}

export function OfflineSheet({ open, onClose, map, basemap }: Props) {
  const [areas, setAreas] = useState<SavedArea[]>(() => listAreas());
  const [detail, setDetail] = useState<(typeof DETAIL)[number]['id']>('high');
  const [name, setName] = useState('');
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    if (open && map) setBounds(viewBounds(map));
  }, [open, map]);

  const maxZoom = DETAIL.find((d) => d.id === detail)!.maxZoom;
  const minZoom = Math.max(8, maxZoom - 6);
  const tiles = bounds ? estimate(basemap, bounds, minZoom, maxZoom) : 0;
  const tooBig = tiles > MAX_TILES;

  async function download() {
    if (!bounds) return;
    setError(null);
    abort.current = new AbortController();
    setProgress({ done: 0, failed: 0, total: tiles });
    try {
      const area = await saveArea(
        { name: name.trim() || `Area ${areas.length + 1}`, basemap, bounds, minZoom, maxZoom },
        setProgress,
        abort.current.signal,
      );
      setAreas(listAreas());
      setName('');
      if (area.tiles === 0) setError('No tiles came down. Check your signal and try again.');
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError((e as Error).message);
    } finally {
      setProgress(null);
      abort.current = null;
    }
  }

  return (
    <BottomSheet title="Offline Maps" open={open} onClose={onClose}>
      <h3 className="sheet-section">Save what's on screen</h3>
      <p className="hint">
        Saves the {BASEMAP_LABELS[basemap].toLowerCase()} map for the area you're looking at, so it works with no service.
      </p>
      <input
        className="text-input"
        placeholder="Name this area"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={40}
      />
      <div className="segmented" role="radiogroup" aria-label="Detail">
        {DETAIL.map((d) => (
          <button key={d.id} role="radio" aria-checked={d.id === detail} className={d.id === detail ? 'is-active' : ''} onClick={() => setDetail(d.id)}>
            {d.label}
          </button>
        ))}
      </div>
      <p className={`hint ${tooBig ? 'warn' : ''}`}>
        {tooBig
          ? `${tiles.toLocaleString()} tiles is too much. Zoom in or lower the detail.`
          : `About ${tiles.toLocaleString()} tiles, roughly ${Math.max(1, Math.round((tiles * 25) / 1024))} MB.`}
      </p>
      {progress ? (
        <div className="progress">
          <div className="progress-bar" style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }} />
          <span>
            {progress.done} of {progress.total}
            {progress.failed ? `, ${progress.failed} failed` : ''}
          </span>
          <button className="text-btn" onClick={() => abort.current?.abort()}>
            Cancel
          </button>
        </div>
      ) : (
        <button className="primary-btn" disabled={!bounds || tooBig || tiles === 0} onClick={download}>
          Download area
        </button>
      )}
      {error && <p className="hint warn">{error}</p>}

      <h3 className="sheet-section">Saved areas</h3>
      {areas.length === 0 ? (
        <p className="hint">Nothing saved yet.</p>
      ) : (
        <ul className="area-list">
          {areas.map((a) => (
            <li key={a.id} className="area-row">
              <button
                className="area-main"
                onClick={() => {
                  map?.fitBounds([[a.bounds.west, a.bounds.south], [a.bounds.east, a.bounds.north]], { padding: 20 });
                  onClose();
                }}
              >
                <strong>{a.name}</strong>
                <span>
                  {BASEMAP_LABELS[a.basemap]} · {a.tiles.toLocaleString()} tiles · {new Date(a.savedAt).toLocaleDateString()}
                </span>
              </button>
              <button
                className="icon-btn"
                aria-label={`Delete ${a.name}`}
                onClick={async () => {
                  await deleteArea(a.id);
                  setAreas(listAreas());
                }}
              >
                <TrashIcon />
              </button>
            </li>
          ))}
        </ul>
      )}
    </BottomSheet>
  );
}
