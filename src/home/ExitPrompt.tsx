import { useState } from 'react';
import { saveSnag } from './snag';
import { useJournal } from '../journal/store';
import { useTools } from '../tools/store';
import { distance } from '../map/geo';
import { samplesBetween } from '../journal/windLog';
import { useEsau } from '../esau/ui/store';
import './home.css';

/** "Did you snag anything?" Saved on this phone only. */
export function ExitPrompt({ open, onClose, onHarvest }: { open: boolean; onClose: () => void; onHarvest?: () => void }) {
  const [yes, setYes] = useState<boolean | null>(null);
  const [what, setWhat] = useState('');
  const [where, setWhere] = useState('');
  if (!open) return null;
  const record = (snagged: 'yes' | 'no', what?: string) => {
    const tools = useTools.getState();
    const esau = useEsau.getState();
    const hour = esau.grid?.weather.hours[esau.hourIndex];
    // Only link a route that was just recorded; an old track is not today's hunt.
    const latest = tools.tracks[0];
    const track = latest && Date.now() - latest.endedAt < 6 * 3600e3 ? latest : null;
    const near = (p: [number, number]) => !!track && track.points.some((t) => distance(t.lngLat, p) < 300);
    useJournal.getState().add({
      id: `j-${crypto.randomUUID()}`,
      trackId: track?.id ?? null,
      date: new Date().toLocaleDateString('en-CA'),
      species: esau.species,
      weapon: esau.weapon,
      snagged,
      what,
      windFromDeg: hour?.windFrom ?? null,
      wind: track ? samplesBetween(track.startedAt - 3600e3, track.endedAt + 1800e3) : [],
      beds: tools.waypoints.filter((w) => w.icon === 'bed' && near(w.position)).map((w) => w.position),
      trails: tools.waypoints.filter((w) => w.icon === 'trail' && near(w.position)).map((w) => w.position),
    });
  };
  const saveYes = () => {
    saveSnag({ at: Date.now(), yes: true, what: what || undefined, where: where || undefined });
    record('yes', what || undefined);
  };
  const finish = () => {
    setYes(null);
    setWhat('');
    setWhere('');
    onClose();
  };
  return (
    <div className="tutorial" role="dialog" aria-label="Did you snag anything?" data-testid="exit-prompt">
      <div className="tutorial-card">
        <h2>Did you snag anything?</h2>
        {yes === null ? (
          <div className="tutorial-actions">
            <button
              className="link-btn"
              data-testid="snag-no"
              onClick={() => {
                saveSnag({ at: Date.now(), yes: false });
                record('no');
                finish();
              }}
            >
              Not this time
            </button>
            <button className="pill-btn" data-testid="snag-yes" onClick={() => setYes(true)}>
              Yes
            </button>
          </div>
        ) : (
          <>
            <input className="text-input" data-testid="snag-what" placeholder="What?" value={what} onChange={(e) => setWhat(e.target.value)} />
            <input className="text-input" placeholder="Where?" value={where} onChange={(e) => setWhere(e.target.value)} />
            <p className="hint">Saved on this phone only.</p>
            {onHarvest && (
              <button
                className="link-btn"
                data-testid="snag-harvest"
                onClick={() => {
                  saveYes();
                  finish();
                  onHarvest();
                }}
              >
                What do I do now? (tagging and check-in)
              </button>
            )}
            <div className="tutorial-actions">
              <button className="link-btn" onClick={finish}>
                Cancel
              </button>
              <button
                className="pill-btn"
                data-testid="snag-save"
                onClick={() => {
                  saveYes();
                  finish();
                }}
              >
                Save
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
