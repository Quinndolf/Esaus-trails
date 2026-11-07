import { useEffect } from 'react';
import type { Map as MLMap } from 'maplibre-gl';
import { analyzeArea } from '../esau/ui/analyzeArea';
import { useEsau } from '../esau/ui/store';
import { ensureGroundForView, visibleBox } from '../hour/view';
import './home.css';

/**
 * "Analyze area": Esau reads the ground for the chosen animal, weapon and hour, and narrates the top sit spots.
 */
export function AnalyzePill({ map }: { map: MLMap | null }) {
  useScreenView(map);
  const species = useEsau((s) => s.species);
  const status = useEsau((s) => s.status);
  if (!species || species === 'ginseng') return null;
  return (
    <button
      className="pill-btn analyze-pill"
      data-testid="analyze-pill"
      disabled={!map || status === 'loading-ground' || status === 'asking'}
      onClick={() => {
        // Read what's on screen (walkable size), then analyze it.
        if (!map) return;
        // Esau reads all the ground loaded around here, but picks and talks only about what is on screen.
        void ensureGroundForView(map).then(() => {
          useEsau.setState({ view: visibleBox(map) });
          return analyzeArea();
        });
      }}
    >
      Analyze area
    </button>
  );
}

/**
 * Keeps Esau's idea of the screen current as the hunter pans and zooms, so a tap or a follow-up question
 * is read against the map they are looking at now, never an earlier, bigger one.
 */
export function useScreenView(map: MLMap | null) {
  useEffect(() => {
    if (!map) return;
    const update = () => useEsau.setState({ view: visibleBox(map) });
    update();
    map.on('moveend', update);
    return () => void map.off('moveend', update);
  }, [map]);
}
