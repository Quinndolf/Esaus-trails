import type { LatLng } from '../types';
import { analyzeHour, type Analysis } from '../analyze';
import { nearestHour, useEsau } from './store';
import { useHour } from '../../hour/store';
import type { LngLat } from '../../model/geo';

/** Works out sit spots, the legal read and banners for the hour the slider points at. Null until the ground is loaded. */
export function analysisForSlider(sit: LatLng | null): Analysis | null {
  const h = useHour.getState();
  const e = useEsau.getState();
  if (!h.grid || !h.conditions || !h.movement || !e.species) return null;
  const hc = h.conditions.at(h.date);
  const mv = h.movement.at(hc.sun, hc.weather, hc.wind, hc.atmosphere.movementFactor, h.date);
  return analyzeHour({
    grid: h.grid,
    movement: mv,
    wind: hc.wind,
    species: e.species,
    weapon: e.weapon,
    at: h.date,
    sit: sit ? ([sit.lng, sit.lat] as LngLat) : null,
    hunter: e.hunter ? ([e.hunter.lng, e.hunter.lat] as LngLat) : null,
  });
}

/** Make the Esau store ask the slider for an analysis on every read. Call once at app start. */
export function registerAnalyzer() {
  useEsau.setState({ analyzer: analysisForSlider });
}

/**
 * The Analyze area button: Esau reads the whole view for the chosen animal, weapon and hour, then talks
 * about the best sit spot. Needs the hour model's ground to be loaded (the slider loads it on first use).
 */
export async function analyzeArea(): Promise<void> {
  const e = useEsau.getState();
  const h = useHour.getState();
  if (!e.species) return e.setChoosing(true);
  if (!h.grid || !h.conditions || !h.movement) {
    useEsau.setState({ open: true, status: 'error', error: "Still reading the ground. Give it a moment and try again." });
    return;
  }
  const an = analysisForSlider(e.sit);
  const best = an?.spots[0];
  const centre: LatLng = best
    ? { lat: best.lngLat[1], lng: best.lngLat[0] }
    : e.sit ?? (e.hunter ? { lat: e.hunter.lat, lng: e.hunter.lng } : { lat: (h.grid.north + h.grid.south) / 2, lng: (h.grid.west + h.grid.east) / 2 });
  useEsau.setState({
    open: true,
    spot: centre,
    grid: h.grid,
    hourIndex: nearestHour(h.grid, h.date),
    reply: null,
    history: [],
    status: 'asking',
    error: null,
    analysis: an,
  });
  await useEsau.getState().ask();
}
