import { useState } from 'react';
import './home.css';

const KEY = 'esau-tutorial-seen';
const STEPS = [
  { title: 'Pick your animal', body: 'The chip at top left sets the animal and your weapon. Everything on the map follows it.' },
  { title: 'Tap the map', body: "Tap where you'd sit. Esau tells you what the animal is doing right now, and you can ask him to teach you more." },
  { title: 'Slide the hour', body: 'The bar at the bottom moves the day. Blue shading is rising air, dark red is air pulling down.' },
  { title: 'Tools, Layers, My Location', body: 'Tools (bottom) holds calls, photos, marks and your tracker. Layers and My Location are on the right.' },
];

function seen(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/** A skippable walk through the buttons, shown on first launch only. */
export function Tutorial() {
  const [open, setOpen] = useState(() => !seen());
  const [i, setI] = useState(0);
  if (!open) return null;
  const done = () => {
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      /* ignore */
    }
    setOpen(false);
  };
  const step = STEPS[i];
  return (
    <div className="tutorial" role="dialog" aria-label="Quick tour" data-testid="tutorial">
      <div className="tutorial-card">
        <small>
          {i + 1} of {STEPS.length}
        </small>
        <h2>{step.title}</h2>
        <p>{step.body}</p>
        <div className="tutorial-actions">
          <button className="link-btn" data-testid="tutorial-skip" onClick={done}>
            Skip
          </button>
          <button className="pill-btn" onClick={() => (i + 1 < STEPS.length ? setI(i + 1) : done())}>
            {i + 1 < STEPS.length ? 'Next' : 'Got it'}
          </button>
        </div>
      </div>
    </div>
  );
}
