import { useEffect, useState } from 'react';
import type { Map as MLMap } from 'maplibre-gl';
import { showNorthButton } from './rotation';

/** onX-style compass: appears when the map is turned, its needle follows north, tap to face north again. */
export function NorthButton({ map }: { map: MLMap | null }) {
  const [bearing, setBearing] = useState(0);
  useEffect(() => {
    if (!map) return;
    const update = () => setBearing(map.getBearing());
    update();
    map.on('rotate', update);
    return () => void map.off('rotate', update);
  }, [map]);
  if (!map || !showNorthButton(bearing)) return null;
  return (
    <button
      className="frost-btn north-btn"
      aria-label="Facing north-up reset. Tap to turn the map north"
      data-testid="north"
      onClick={() => map.easeTo({ bearing: 0, duration: 300 })}
    >
      <svg viewBox="0 0 24 24" style={{ transform: `rotate(${-bearing}deg)` }} aria-hidden="true">
        <path d="M12 3 16 12H8Z" fill="#d93025" />
        <path d="M12 21 8 12h8Z" fill="currentColor" opacity=".45" />
      </svg>
    </button>
  );
}
