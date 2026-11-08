import { useEffect } from 'react';
import type { Map as MLMap } from 'maplibre-gl';
import { analysisForSlider, analyzeArea } from '../esau/ui/analyzeArea';
import { useEsau } from '../esau/ui/store';
import { ensureGroundForView, visibleBox } from '../hour/view';
import { insideBounds, type Bounds, type LngLat } from '../model/geo';
import './home.css';

/**
 * "Analyze area": Esau reads the ground for the chosen animal, weapon and hour, and narrates the top sit spots.
 * It never moves the map, except to zoom out just enough to show a clearly better sit a short walk off the screen.
 */
export function AnalyzePill({ map }: { map: MLMap | null }) {
  useScreenView(map);
  useShowSpot(map);
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
        void ensureGroundForView(map).then(async () => {
          useEsau.setState({ view: visibleBox(map) });
          const off = analysisForSlider(useEsau.getState().sit)?.verdict?.offScreen;
          if (off) {
            await zoomOutTo(map, off.lngLat);
            await ensureGroundForView(map); // the wider screen may reach past the ground read so far
          }
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

/** "Zoom out to it" on the stay-or-move card: show the better spot, then read the new screen. */
export function useShowSpot(map: MLMap | null) {
  const want = useEsau((s) => s.showSpot);
  useEffect(() => {
    if (!map || !want) return;
    useEsau.setState({ showSpot: null });
    void zoomOutTo(map, want)
      .then(() => ensureGroundForView(map))
      .then(() => analyzeArea());
  }, [map, want]);
}

/** The screen grown just enough to take in `p`, with a margin on every side so it is not on the edge. */
export function boxIncluding(v: Bounds, [lng, lat]: LngLat, margin = 0.08): Bounds {
  const west = Math.min(v.west, lng), east = Math.max(v.east, lng);
  const south = Math.min(v.south, lat), north = Math.max(v.north, lat);
  const dx = (east - west) * margin, dy = (north - south) * margin;
  return {
    west: lng < v.west ? west - dx : west,
    east: lng > v.east ? east + dx : east,
    south: lat < v.south ? south - dy : south,
    north: lat > v.north ? north + dy : north,
  };
}

/**
 * Zoom out (never in) until `p` is on screen, keeping the map's turn, and update Esau's view when it lands.
 * A turned map shows less than the box it was fit to, so if `p` is still off the screen it widens once more.
 */
export async function zoomOutTo(map: MLMap, p: LngLat): Promise<void> {
  await fitOnce(map, p, 0.08);
  if (!insideBounds(visibleBox(map), p)) await fitOnce(map, p, 0.3);
}

function fitOnce(map: MLMap, p: LngLat, margin: number): Promise<void> {
  const b = boxIncluding(visibleBox(map), p, margin);
  return new Promise<void>((done) => {
    let landed = false;
    const finish = () => {
      if (landed) return;
      landed = true;
      clearTimeout(timer);
      useEsau.setState({ view: visibleBox(map) });
      done();
    };
    const timer = setTimeout(finish, 2000); // in case the map never reports it landed
    map.once('moveend', finish);
    map.fitBounds(
      [
        [b.west, b.south],
        [b.east, b.north],
      ],
      { bearing: map.getBearing(), pitch: map.getPitch(), duration: 600, maxZoom: map.getZoom() },
    );
  });
}
