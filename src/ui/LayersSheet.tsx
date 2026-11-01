import { useState } from 'react';
import { BASEMAP_LABELS, BASEMAP_ORDER, type BasemapId } from '../map/basemaps';
import { activeOptionIds } from '../layers/tiles';
import type { LayerDef, LayerFolder, LayerState } from '../layers/types';
import { BottomSheet } from './BottomSheet';
import { CheckIcon, ChevronLeft, ChevronRight } from './icons';
import { Toggle } from './Toggle';

interface Props {
  open: boolean;
  onClose: () => void;
  basemap: BasemapId;
  onBasemap: (b: BasemapId) => void;
  folders: LayerFolder[];
  state: LayerState;
  onToggle: (layerId: string, on: boolean) => void;
  onOptions: (layerId: string, optionIds: string[]) => void;
  /** Opens the offline-download sheet. */
  onDownload?: () => void;
}

type View = { kind: 'home' } | { kind: 'folder'; folderId: string } | { kind: 'options'; folderId: string; layerId: string };

const STATE_NAMES: Record<string, string> = { KY: 'Kentucky' };

export function LayersSheet({ open, onClose, basemap, onBasemap, folders, state, onToggle, onOptions, onDownload }: Props) {
  const [view, setView] = useState<View>({ kind: 'home' });
  const folder = view.kind !== 'home' ? folders.find((f) => f.id === view.folderId) : undefined;
  const layer = view.kind === 'options' ? folder?.layers.find((l) => l.id === view.layerId) : undefined;

  const title = layer ? layer.name : folder ? folder.name : 'Map Layers';
  const back =
    view.kind === 'options'
      ? () => setView({ kind: 'folder', folderId: view.folderId })
      : view.kind === 'folder'
        ? () => setView({ kind: 'home' })
        : undefined;

  const states = [...new Set(folders.filter((f) => f.state).map((f) => f.state!))];
  const national = folders.filter((f) => !f.state);
  const activeCount = (f: LayerFolder) => f.layers.filter((l) => state.on[l.id] && !l.unavailable).length;

  const folderRow = (f: LayerFolder) => {
    const n = activeCount(f);
    const usable = f.layers.filter((l) => !l.unavailable);
    return (
      <li key={f.id} className="folder-row" onClick={() => setView({ kind: 'folder', folderId: f.id })}>
        <div className="row-main">
          <strong>{f.name}</strong>
          <span>{n ? `${n} of ${f.layers.length} on` : `${f.layers.length} ${f.layers.length === 1 ? 'layer' : 'layers'}`}</span>
        </div>
        <Toggle
          label={`All ${f.name}`}
          on={n > 0}
          disabled={!usable.length}
          onChange={(on) => usable.forEach((l) => onToggle(l.id, on))}
        />
        <ChevronRight className="chev" />
      </li>
    );
  };

  return (
    <BottomSheet title={title} open={open} onClose={onClose} onBack={back}>
      {view.kind === 'home' && (
        <>
          <h3 className="sheet-section">Basemap</h3>
          <div className="basemap-cards">
            {BASEMAP_ORDER.map((id) => (
              <button
                key={id}
                className={`basemap-card ${id === basemap ? 'is-active' : ''}`}
                onClick={() => onBasemap(id)}
                aria-pressed={id === basemap}
              >
                <span className={`basemap-swatch swatch-${id}`} />
                {BASEMAP_LABELS[id]}
              </button>
            ))}
          </div>
          {onDownload && (
            <button className="primary-btn" data-testid="download-area" onClick={onDownload}>
              Download this area
            </button>
          )}
          {states.map((s) => (
            <div key={s}>
              <h3 className="sheet-section">{STATE_NAMES[s] ?? s}</h3>
              <ul className="folder-list">{folders.filter((f) => f.state === s).map(folderRow)}</ul>
            </div>
          ))}
          <h3 className="sheet-section">Nationwide</h3>
          <ul className="folder-list">{national.map(folderRow)}</ul>
        </>
      )}

      {view.kind === 'folder' && folder && (
        <ul className="folder-list">
          {folder.layers.map((l) => (
            <LayerRow
              key={l.id}
              layer={l}
              on={!!state.on[l.id]}
              optionCount={l.options ? activeOptionIds(l, state.options[l.id]).length : 0}
              onToggle={(on) => onToggle(l.id, on)}
              onOpenOptions={() => setView({ kind: 'options', folderId: folder.id, layerId: l.id })}
            />
          ))}
        </ul>
      )}

      {view.kind === 'options' && layer && layer.options && (
        <>
          <p className="hint">{layer.description}</p>
          <div className="layer-master">
            <span>Show {layer.name}</span>
            <Toggle label={layer.name} on={!!state.on[layer.id]} onChange={(on) => onToggle(layer.id, on)} />
          </div>
          <h3 className="sheet-section">View options</h3>
          <ul className="folder-list">
            {layer.options.map((o) => {
              const picked = activeOptionIds(layer, state.options[layer.id]);
              const checked = picked.includes(o.id);
              return (
                <li
                  key={o.id}
                  className="option-row"
                  role={layer.exclusive ? 'radio' : 'checkbox'}
                  aria-checked={checked}
                  onClick={() => {
                    const next = layer.exclusive
                      ? [o.id]
                      : checked
                        ? picked.filter((id) => id !== o.id)
                        : [...picked, o.id];
                    onOptions(layer.id, next);
                    if (!checked) onToggle(layer.id, true);
                  }}
                >
                  {o.color && <span className="swatch" style={{ background: o.color }} />}
                  <span className="row-main">{o.name}</span>
                  <span className={`check ${checked ? 'is-on' : ''}`}>{checked && <CheckIcon />}</span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </BottomSheet>
  );
}

function LayerRow(props: {
  layer: LayerDef;
  on: boolean;
  optionCount: number;
  onToggle: (on: boolean) => void;
  onOpenOptions: () => void;
}) {
  const { layer, on, optionCount, onToggle, onOpenOptions } = props;
  const hasOptions = !!layer.options?.length;
  return (
    <li className={`layer-row ${layer.unavailable ? 'is-disabled' : ''}`} onClick={hasOptions ? onOpenOptions : undefined}>
      {layer.color && <span className="swatch" style={{ background: layer.color }} />}
      <div className="row-main">
        <strong>{layer.name}</strong>
        <span>{layer.unavailable ?? layer.description}</span>
        {hasOptions && (
          <button
            className="link-btn"
            onClick={(e) => {
              e.stopPropagation();
              onOpenOptions();
            }}
          >
            View options ({optionCount} of {layer.options!.length}) <ChevronRight width={14} height={14} />
          </button>
        )}
      </div>
      <Toggle label={layer.name} on={on && !layer.unavailable} disabled={!!layer.unavailable} onChange={onToggle} />
    </li>
  );
}
