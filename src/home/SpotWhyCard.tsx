import { useEffect } from 'react';
import { create } from 'zustand';
import { useEsau } from '../esau/ui/store';
import { useHour } from '../hour/store';
import { spotWhy } from '../esau/spotWhy';
import './home.css';

/** Which of Esau's numbered sit spots the hunter tapped. Null when the card is closed. */
export const useSpotWhy = create<{ rank: number | null; show(rank: number | null): void }>((set) => ({
  rank: null,
  show: (rank) => set({ rank }),
}));

/** Tap a numbered sit spot after Analyze area: Esau's reasons for that pick, for the hour the slider is on. */
export function SpotWhyCard() {
  const rank = useSpotWhy((s) => s.rank);
  const spots = useEsau((s) => s.analysis?.spots);
  const conditions = useHour((s) => s.conditions);
  const date = useHour((s) => s.date);
  const spot = rank == null ? undefined : spots?.find((s) => s.rank === rank);

  // A new read without this spot (or Esau closed) closes the card, so it doesn't pop back later.
  useEffect(() => {
    if (rank != null && !spot) useSpotWhy.getState().show(null);
  }, [rank, spot]);

  if (!spot) return null;
  let reading = null;
  try {
    reading = conditions ? conditions.read(spot.lngLat, date) : null;
  } catch {
    reading = null;
  }
  const why = spotWhy(spot, reading);
  const close = () => useSpotWhy.getState().show(null);
  return (
    <div className="spot-why" role="dialog" aria-label={why.title} data-testid="spot-why">
      <header>
        <h2>{why.title}</h2>
        <button className="link-btn" data-testid="spot-why-close" onClick={close}>
          Close
        </button>
      </header>
      <dl>
        {why.lines.map((l) => (
          <div key={l.label}>
            <dt>{l.label}</dt>
            <dd>{l.text}</dd>
          </div>
        ))}
      </dl>
      <button
        className="pill-btn"
        data-testid="spot-why-sit"
        onClick={() => {
          close();
          void useEsau.getState().tapSpot({ lat: spot.lngLat[1], lng: spot.lngLat[0] });
        }}
      >
        Sit here and ask Esau
      </button>
    </div>
  );
}
