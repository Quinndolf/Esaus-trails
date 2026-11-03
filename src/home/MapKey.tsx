import { useEffect } from 'react';
import { create } from 'zustand';
import { useEsau } from '../esau/ui/store';
import { useHour } from '../hour/store';
import { hourScope } from '../hour/scope';
import { legendItems, type Explained, type Swatch } from '../hour/legend';
import { useSpotWhy } from './SpotWhyCard';
import './home.css';

interface ExplainState {
  /** The tapped mark Esau is explaining, and where it was tapped. */
  item: (Explained & { lngLat: [number, number] }) | null;
  keyOpen: boolean;
  show(item: ExplainState['item']): void;
  openKey(open: boolean): void;
}

export const useExplain = create<ExplainState>((set) => ({
  item: null,
  keyOpen: false,
  // One card at a time: opening this closes the sit-spot card, and the other way round below.
  show: (item) => {
    if (item) useSpotWhy.getState().show(null);
    set({ item, keyOpen: false });
  },
  openKey: (keyOpen) => {
    if (keyOpen) useSpotWhy.getState().show(null);
    set({ keyOpen, item: null });
  },
}));

useSpotWhy.subscribe((s) => {
  if (s.rank != null && (useExplain.getState().item || useExplain.getState().keyOpen)) useExplain.setState({ item: null, keyOpen: false });
});

/** A tiny picture of each map mark, drawn the way the map draws it. */
export function SwatchIcon({ s }: { s: Swatch }) {
  const box = { width: 34, height: 18, viewBox: '0 0 34 18', 'aria-hidden': true } as const;
  switch (s.kind) {
    case 'dash':
    case 'line':
      return (
        <svg {...box}>
          <line x1="3" y1="9" x2="31" y2="9" stroke="#1a1208" strokeOpacity="0.6" strokeWidth="6" strokeLinecap="round" />
          <line x1="3" y1="9" x2="31" y2="9" stroke={s.color} strokeWidth="3.5" strokeLinecap="round" strokeDasharray={s.kind === 'dash' ? '7 4' : undefined} />
        </svg>
      );
    case 'arrow':
    case 'tick': {
      const w = s.kind === 'arrow' ? 2.2 : 1.8;
      const one = (x: number, c: string) => (
        <g stroke={c} strokeWidth={w} fill="none" strokeLinecap="round" strokeLinejoin="round">
          <line x1={x} y1="13" x2={x + 11} y2="5" />
          <polyline points={`${x + 6},4.5 ${x + 11},5 ${x + 9.5},9.5`} />
        </g>
      );
      return (
        <svg {...box} style={{ background: '#4a5a46', borderRadius: 4 }}>
          {one(3, s.color)}
          {s.color2 && one(18, s.color2)}
        </svg>
      );
    }
    case 'dot':
      return (
        <svg {...box}>
          <circle cx="17" cy="9" r="6.5" fill={s.color} stroke={s.ring} strokeWidth="2" />
        </svg>
      );
    case 'fill':
      return (
        <svg {...box}>
          {s.colors.map((c, i) => (
            <rect key={c} x={2 + (i * 30) / s.colors.length} y="2" width={30 / s.colors.length} height="14" fill={c} opacity="0.85" />
          ))}
        </svg>
      );
    case 'ring':
      return (
        <svg {...box}>
          <circle cx="17" cy="9" r="7.5" fill="#fff" stroke="#1c2a1f" strokeWidth="1.8" strokeDasharray="3 2" />
          <text x="17" y="12.5" textAnchor="middle" fontSize="9" fontWeight="800" fill="#1c2a1f">
            {s.label ?? ''}
          </text>
        </svg>
      );
  }
}

/** The "?" button on the right: opens the map key. */
export function MapKeyButton() {
  return (
    <button className="frost-btn map-key-btn" data-testid="map-key-btn" aria-label="Map key: what the lines and dots mean" onClick={() => useExplain.getState().openKey(true)}>
      ?
    </button>
  );
}

/** Every mark the map is drawing for this animal, with a picture and a plain-words meaning. */
export function MapKeyCard() {
  const open = useExplain((s) => s.keyOpen);
  const species = useEsau((s) => s.species);
  const food = useHour((s) => s.showFood);
  const thermals = useHour((s) => s.showThermals);
  if (!open) return null;
  const items = legendItems(hourScope(species), { food, thermals });
  return (
    <div className="spot-why map-key" role="dialog" aria-label="Map key" data-testid="map-key">
      <header>
        <h2>What's on the map</h2>
        <button className="link-btn" data-testid="map-key-close" onClick={() => useExplain.getState().openKey(false)}>
          Close
        </button>
      </header>
      {items.length ? (
        <>
          <p className="map-key-tip">Tap any line, dot or arrow on the map and Esau tells you what it is.</p>
          <ul>
            {items.map((i) => (
              <li key={i.id} data-testid={`key-${i.id}`}>
                <SwatchIcon s={i.swatch} />
                <div>
                  <strong>{i.name}</strong>
                  <span>{i.says}</span>
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p>Pick an animal with the chip at top left, and the map fills in with what matters for it.</p>
      )}
    </div>
  );
}

/** A tapped trail, bed, arrow or tick: Esau says what it is. */
export function WhatsThisCard() {
  const item = useExplain((s) => s.item);
  // Tapping somewhere else for a read closes it.
  useEffect(
    () =>
      useEsau.subscribe((s, prev) => {
        if (s.spot !== prev.spot) useExplain.getState().show(null);
      }),
    [],
  );
  if (!item) return null;
  return (
    <div className="spot-why" role="dialog" aria-label={item.title} data-testid="whats-this">
      <header>
        <h2>{item.title}</h2>
        <button className="link-btn" data-testid="whats-this-close" onClick={() => useExplain.getState().show(null)}>
          Close
        </button>
      </header>
      <p className="whats-this-text">{item.text}</p>
      <div className="whats-this-actions">
        <button
          className="pill-btn"
          data-testid="whats-this-sit"
          onClick={() => {
            useExplain.getState().show(null);
            void useEsau.getState().tapSpot({ lat: item.lngLat[1], lng: item.lngLat[0] });
          }}
        >
          Ask Esau about here
        </button>
        <button className="link-btn" data-testid="whats-this-key" onClick={() => useExplain.getState().openKey(true)}>
          Map key
        </button>
      </div>
    </div>
  );
}
