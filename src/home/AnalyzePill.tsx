import type { Map as MLMap } from 'maplibre-gl';
import { analyzeArea } from '../esau/ui/analyzeArea';
import { useEsau } from '../esau/ui/store';
import { ensureGroundForView, visibleBox } from '../hour/view';
import './home.css';

/**
 * "Analyze area": Esau reads the ground for the chosen animal, weapon and hour, and narrates the top sit spots.
 */
export function AnalyzePill({ map }: { map: MLMap | null }) {
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
        // Esau reads all the ground loaded around here, but picks sit spots only on screen.
        const view = visibleBox(map);
        void ensureGroundForView(map).then(() => {
          useEsau.setState({ view });
          return analyzeArea();
        });
      }}
    >
      Analyze area
    </button>
  );
}
