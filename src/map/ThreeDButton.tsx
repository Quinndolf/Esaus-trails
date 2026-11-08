import { useEffect, useState } from 'react';
import type { Map as MLMap } from 'maplibre-gl';

const PITCH = 60;
const EXAGGERATION = 1.4;

/** Turns the 3D terrain view on or off. Off (the default) keeps the map flat so "what's on screen" stays simple. */
export function setTerrain3D(map: MLMap, on: boolean) {
  if (on) {
    map.setTerrain({ source: 'dem', exaggeration: EXAGGERATION });
    map.touchPitch.enable();
    map.easeTo({ pitch: PITCH, duration: 600 });
  } else {
    map.easeTo({ pitch: 0, bearing: 0, duration: 400 });
    map.once('moveend', () => map.setTerrain(null));
    map.touchPitch.disable();
  }
}

export function ThreeDButton({ map }: { map: MLMap | null }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    map?.touchPitch.disable();
  }, [map]);
  if (!map) return null;
  return (
    <button
      className={`frost-btn three-d-btn ${on ? 'is-on' : ''}`}
      aria-label={on ? 'Turn 3D view off' : 'Turn 3D view on'}
      aria-pressed={on}
      data-testid="three-d"
      onClick={() => {
        setTerrain3D(map, !on);
        setOn(!on);
      }}
    >
      3D
    </button>
  );
}
