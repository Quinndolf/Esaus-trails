import { BottomSheet } from './BottomSheet';

const TOOLS = ['Mark my location', 'Waypoints', 'Draw shapes', 'Measure distance', 'Tracker'];

interface Props {
  open: boolean;
  onClose: () => void;
  onPhotos: () => void;
}

export function ToolsSheet({ open, onClose, onPhotos }: Props) {
  return (
    <BottomSheet title="Tools" open={open} onClose={onClose}>
      <div className="tool-grid">
        <button className="tool-tile" onClick={onPhotos}>
          Photos
          <span className="hint">Take or add a photo</span>
        </button>
        {TOOLS.map((t) => (
          <button key={t} className="tool-tile" disabled>
            {t}
            <span className="soon">Phase 3</span>
          </button>
        ))}
      </div>
    </BottomSheet>
  );
}
