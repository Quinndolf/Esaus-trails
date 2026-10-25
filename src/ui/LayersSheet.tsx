import { BASEMAP_LABELS, BASEMAP_ORDER, type BasemapId } from '../map/basemaps';
import { BottomSheet } from './BottomSheet';

const COMING = [
  'Private lands',
  'Government lands',
  'Hunting districts',
  'Current conditions',
  'Land and access',
  'Roads',
  'Trails',
  'Trees',
  'Crops',
  'Soil',
  'Wildlife',
];

interface Props {
  open: boolean;
  onClose: () => void;
  basemap: BasemapId;
  onBasemap: (b: BasemapId) => void;
}

export function LayersSheet({ open, onClose, basemap, onBasemap }: Props) {
  return (
    <BottomSheet title="Map Layers" open={open} onClose={onClose}>
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
      <h3 className="sheet-section">Layer folders</h3>
      <ul className="folder-list">
        {COMING.map((name) => (
          <li key={name} className="folder-row is-disabled">
            <span>{name}</span>
            <span className="soon">Phase 2</span>
          </li>
        ))}
      </ul>
    </BottomSheet>
  );
}
