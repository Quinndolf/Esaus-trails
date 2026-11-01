import { useState } from 'react';
import { saveSnag } from './snag';
import './home.css';

/** "Did you snag anything?" Saved on this phone only. */
export function ExitPrompt({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [yes, setYes] = useState<boolean | null>(null);
  const [what, setWhat] = useState('');
  const [where, setWhere] = useState('');
  if (!open) return null;
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
            <div className="tutorial-actions">
              <button className="link-btn" onClick={finish}>
                Cancel
              </button>
              <button
                className="pill-btn"
                data-testid="snag-save"
                onClick={() => {
                  saveSnag({ at: Date.now(), yes: true, what: what || undefined, where: where || undefined });
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
