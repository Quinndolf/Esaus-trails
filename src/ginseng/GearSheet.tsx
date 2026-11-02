import { BottomSheet } from '../ui/BottomSheet';
import { GINSENG_GEAR } from './gear';

/** The ginseng tool list: shown in place of a weapon. */
export function GearSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <BottomSheet title="What to bring" open={open} onClose={onClose}>
      <ul className="area-list" data-testid="ginseng-gear">
        {GINSENG_GEAR.map((g) => (
          <li key={g.name} className="area-row">
            <div className="area-main">
              <strong>{g.name}</strong>
              <span>{g.why}</span>
            </div>
          </li>
        ))}
      </ul>
    </BottomSheet>
  );
}
