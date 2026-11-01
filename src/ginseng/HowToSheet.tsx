import { useEffect, useRef, useState } from 'react';
import { BottomSheet } from '../ui/BottomSheet';
import { SLIDES } from './slides';
import { loadSlidePhotos, type SlidePhotos } from './photos';
import './slides.css';

const AUTO_MS = 9000;

/** Illustrated, animated step-by-step on harvesting ginseng. Swipe, tap Next, or press Play. */
export function HowToSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [photos, setPhotos] = useState<SlidePhotos>({});
  const [showDrawing, setShowDrawing] = useState(false);
  const startX = useRef<number | null>(null);
  const slide = SLIDES[i];
  const photo = photos[slide.id];
  const go = (n: number) => setI(Math.max(0, Math.min(SLIDES.length - 1, n)));

  useEffect(() => {
    if (open) void loadSlidePhotos().then(setPhotos);
  }, [open]);

  useEffect(() => setShowDrawing(false), [i]);

  useEffect(() => {
    if (!open) {
      setI(0);
      setPlaying(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !playing) return;
    const t = setTimeout(() => {
      if (i >= SLIDES.length - 1) setPlaying(false);
      else setI(i + 1);
    }, AUTO_MS);
    return () => clearTimeout(t);
  }, [open, playing, i]);

  return (
    <BottomSheet title="How to harvest ginseng" open={open} onClose={onClose}>
      <div
        className="gs"
        onTouchStart={(e) => (startX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (startX.current == null) return;
          const dx = e.changedTouches[0].clientX - startX.current;
          startX.current = null;
          if (Math.abs(dx) > 50) go(i + (dx < 0 ? 1 : -1));
        }}
      >
        <p className="gs-step">
          Step {i + 1} of {SLIDES.length} · <span className={`gs-tag ${slide.kind === 'law' ? 'is-law' : ''}`}>{slide.kind}</span>
        </p>
        <h3 className="gs-title">{slide.title}</h3>
        {photo && (
          <div className="gs-mode" role="tablist" aria-label="Picture type">
            <button role="tab" aria-selected={!showDrawing} className={!showDrawing ? 'is-on' : ''} onClick={() => setShowDrawing(false)}>
              Photo
            </button>
            <button role="tab" aria-selected={showDrawing} className={showDrawing ? 'is-on' : ''} onClick={() => setShowDrawing(true)}>
              Drawing
            </button>
          </div>
        )}
        {photo && !showDrawing ? (
          <figure className="gs-photo" data-testid="howto-photo">
            <img src={`/ginseng/photos/${photo.file}`} alt={photo.caption} loading="lazy" />
            <figcaption>
              {photo.caption}. {photo.author}, {photo.license}.{' '}
              <a href={photo.source} target="_blank" rel="noreferrer">
                Source
              </a>
            </figcaption>
          </figure>
        ) : (
          <div className="gs-art" key={slide.id} data-testid="howto-art">
            {slide.art}
          </div>
        )}
        <ul className="gs-caption" data-testid="howto-caption">
          {slide.caption.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <div className="gs-dots" role="tablist" aria-label="Steps">
          {SLIDES.map((s, k) => (
            <button key={s.id} role="tab" aria-selected={k === i} aria-label={`Step ${k + 1}: ${s.title}`} className={k === i ? 'is-on' : ''} onClick={() => go(k)} />
          ))}
        </div>
        <div className="gs-nav">
          <button onClick={() => go(i - 1)} disabled={i === 0}>
            Back
          </button>
          <button onClick={() => setPlaying((p) => !p)} aria-pressed={playing}>
            {playing ? 'Pause' : 'Play'}
          </button>
          <button onClick={() => go(i + 1)} disabled={i === SLIDES.length - 1}>
            Next
          </button>
        </div>
        <p className="gs-foot">
          Pictures are drawings unless a photo is shown with its credit. "Law" steps come from Kentucky's regulation; "field practice" is common digger habit, not law; "habitat" steps are clues from University of Kentucky Extension, not proof a plant is there. Not legal
          advice: check the Department of Agriculture before you dig.
        </p>
      </div>
    </BottomSheet>
  );
}
