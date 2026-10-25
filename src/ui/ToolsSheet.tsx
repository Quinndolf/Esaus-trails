import { BottomSheet } from './BottomSheet';

const TOOLS = ['Mark my location', 'Waypoints', 'Draw shapes', 'Measure distance', 'Tracker', 'Add photo'];

export function ToolsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <BottomSheet title="Tools" open={open} onClose={onClose}>
      <div className="tool-grid">
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
