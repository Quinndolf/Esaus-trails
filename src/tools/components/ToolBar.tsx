import { useState } from 'react';
import { formatArea, formatDistance, pathLength, polygonArea } from '../../map/geo';
import { useTools } from '../store';

const TITLES = {
  measure: 'Measure',
  'draw-line': 'Draw line',
  'draw-area': 'Draw area',
  'drop-waypoint': 'Drop waypoint',
} as const;

/** Floating bar while a tool owns map taps: live readout plus undo, clear, save and done. */
export function ToolBar() {
  const mode = useTools((s) => s.mode);
  const draft = useTools((s) => s.draft);
  const { setMode, undoPoint, clearDraft, saveDraft } = useTools.getState();
  const [name, setName] = useState('');

  if (mode === 'none') return null;

  const length = pathLength(draft);
  const isArea = mode === 'draw-area';
  const canSave = mode !== 'drop-waypoint' && draft.length >= (isArea ? 3 : 2);

  let readout: string;
  if (mode === 'drop-waypoint') readout = 'Tap the map where you want it';
  else if (!draft.length) readout = 'Tap the map to add points';
  else if (isArea) readout = draft.length >= 3 ? `${formatArea(polygonArea(draft))} · ${formatDistance(length + (draft.length >= 3 ? pathLength([draft[draft.length - 1], draft[0]]) : 0))} around` : 'Add at least 3 points';
  else readout = draft.length >= 2 ? formatDistance(length) : 'Tap the next point';

  return (
    <div className="tool-bar" data-testid="tool-bar">
      <div className="tool-bar-head">
        <strong>{TITLES[mode]}</strong>
        <span className="tool-bar-readout" data-testid="tool-readout">{readout}</span>
      </div>
      {mode !== 'drop-waypoint' && mode !== 'measure' && canSave && (
        <input className="text-input" placeholder={isArea ? 'Name this area' : 'Name this line'} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
      )}
      <div className="tool-bar-actions">
        {mode !== 'drop-waypoint' && (
          <>
            <button className="chip-btn" onClick={undoPoint} disabled={!draft.length}>
              Undo
            </button>
            <button className="chip-btn" onClick={clearDraft} disabled={!draft.length}>
              Clear
            </button>
          </>
        )}
        {canSave && (
          <button
            className="chip-btn is-primary"
            onClick={() => {
              void saveDraft(name);
              setName('');
            }}
          >
            Save
          </button>
        )}
        <button
          className="chip-btn"
          onClick={() => {
            setMode('none');
            setName('');
          }}
        >
          {mode === 'measure' ? 'Done' : 'Cancel'}
        </button>
      </div>
    </div>
  );
}
