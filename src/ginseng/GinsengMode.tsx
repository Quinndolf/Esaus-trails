import { GearSheet } from './GearSheet';
import { useEffect, useMemo } from 'react';
import type { ImageSource, Map as MLMap } from 'maplibre-gl';
import { useEsau } from '../esau/ui/store';
import { imageCorners } from '../hour/overlays';
import { BottomSheet } from '../ui/BottomSheet';
import { HowToSheet } from './HowToSheet';
import { ginsengField, ginsengPixels } from './model';
import { GINSENG_SOURCES, KY_GINSENG_RULES, seasonStatus } from './rules';
import { useGinseng } from './store';
import './ginseng.css';

const LAYER = 'ginseng-likelihood';
const BLANK_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

function toDataUrl(px: Uint8ClampedArray, w: number, h: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return BLANK_PNG;
  ctx.putImageData(new ImageData(px as Uint8ClampedArray<ArrayBuffer>, w, h), 0, 0);
  return canvas.toDataURL();
}

/** Paints the ginseng likelihood over the ground grid while ginseng mode is on. */
export function useGinsengLayer(map: MLMap | null) {
  const on = useEsau((s) => s.species === 'ginseng');
  const grid = useGinseng((s) => s.grid);
  const field = useMemo(() => (on && grid ? ginsengField(grid) : null), [on, grid]);

  useEffect(() => {
    if (!map) return;
    if (!map.getSource(LAYER)) {
      const before = map.getLayer('gps-accuracy') ? 'gps-accuracy' : undefined;
      const far: [number, number][] = [[0, 0.0001], [0.0001, 0.0001], [0.0001, 0], [0, 0]];
      map.addSource(LAYER, { type: 'image', url: BLANK_PNG, coordinates: far as never });
      map.addLayer(
        { id: LAYER, type: 'raster', source: LAYER, paint: { 'raster-opacity': 0.75, 'raster-resampling': 'linear', 'raster-fade-duration': 0 } },
        before,
      );
    }
    map.setLayoutProperty(LAYER, 'visibility', field ? 'visible' : 'none');
    if (!field || !grid) return;
    (map.getSource(LAYER) as ImageSource).updateImage({
      url: toDataUrl(ginsengPixels(field.score), grid.cols, grid.rows),
      coordinates: imageCorners(grid),
    });
  }, [map, field, grid]);
}

/** Top-of-screen status in ginseng mode: the season, the rules, and a way out. */
export function GinsengPill({ map }: { map: MLMap | null }) {
  const on = useEsau((s) => s.species === 'ginseng');
  const { status, error, setRulesOpen, setHowtoOpen, setGearOpen, exit, load } = useGinseng();
  if (!on) return null;
  const season = seasonStatus(new Date());
  const center = () => {
    const c = map?.getCenter();
    return c ? ([c.lng, c.lat] as [number, number]) : null;
  };
  return (
    <div className={`ginseng-pill ${season.open ? 'is-open' : 'is-closed'}`} data-testid="ginseng-pill">
      <strong>Ginseng mode</strong>
      <span data-testid="ginseng-season">{season.text}</span>
      {status === 'loading' && <span>Reading the ground…</span>}
      {status === 'error' && <span className="warn">{error}</span>}
      <div className="ginseng-actions">
        <button onClick={() => setRulesOpen(true)}>Rules</button>
        <button onClick={() => setGearOpen(true)}>What to bring</button>
        <button onClick={() => setHowtoOpen(true)}>How to dig</button>
        <button
          onClick={() => {
            const c = center();
            if (c) void load(c);
          }}
        >
          {status === 'ready' ? 'Read here' : 'Read ground'}
        </button>
        <button onClick={exit}>Exit</button>
      </div>
    </div>
  );
}

export function GinsengGearSheet() {
  const open = useGinseng((s) => s.gearOpen);
  const setOpen = useGinseng((s) => s.setGearOpen);
  return <GearSheet open={open} onClose={() => setOpen(false)} />;
}

export function GinsengHowToSheet() {
  const open = useGinseng((s) => s.howtoOpen);
  const setOpen = useGinseng((s) => s.setHowtoOpen);
  return <HowToSheet open={open} onClose={() => setOpen(false)} />;
}

export function GinsengRulesSheet() {
  const open = useGinseng((s) => s.rulesOpen);
  const setOpen = useGinseng((s) => s.setRulesOpen);
  const season = seasonStatus(new Date());
  return (
    <BottomSheet title="Kentucky ginseng rules" open={open} onClose={() => setOpen(false)}>
      <p className="ginseng-lede">{season.text}.</p>
      <p className="ginseng-note">
        A summary of Kentucky's rules, not legal advice. Check the regulation and the Department of Agriculture before you dig.
      </p>
      <ul className="ginseng-rules">
        {KY_GINSENG_RULES.map((r) => (
          <li key={r.id}>
            <strong>{r.title}</strong>
            <p>{r.body}</p>
          </li>
        ))}
      </ul>
      <h3 className="sheet-section">About the map</h3>
      <p className="ginseng-note">
        The green shading ranks ground by published habitat factors: cool north and east faces, moderate slope, hardwood shade, and
        moist lower slopes and coves. It is a ranking, not a promise. It cannot see soil, the understory, or a patch someone
        already dug. Get the landowner's permission before you walk in.
      </p>
      <h3 className="sheet-section">Sources</h3>
      <ul className="ginseng-sources">
        {Object.values(GINSENG_SOURCES).map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
      <button
        className="primary-btn"
        onClick={() => {
          setOpen(false);
          useGinseng.getState().setHowtoOpen(true);
        }}
      >
        See how to harvest
      </button>
      <button className="link-btn" onClick={() => setOpen(false)}>
        Got it
      </button>
    </BottomSheet>
  );
}
