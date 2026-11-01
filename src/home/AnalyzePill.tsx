import type { Map as MLMap } from 'maplibre-gl';
import { useEsau } from '../esau/ui/store';
import './home.css';

/**
 * "Analyze area": reads the ground in view for the chosen animal. Uses Esau's analyzeArea once the brain
 * thread lands it; until then reads the middle of the view the way a tap would.
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
        if (!map) return;
        const st = useEsau.getState() as unknown as { analyzeArea?: () => Promise<void> };
        if (st.analyzeArea) return void st.analyzeArea();
        const c = map.getCenter();
        void useEsau.getState().tapSpot({ lat: c.lat, lng: c.lng });
      }}
    >
      Analyze area
    </button>
  );
}
