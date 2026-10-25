import { useState } from 'react';
import { usePhotoPins } from '../store';
import { usePhotoUrl } from '../usePhotoUrl';
import { getDeviceFix } from './usePhotoPicker';

/**
 * Shown when a photo has no GPS in it. The hunter taps the map where it was
 * taken (handled by useManualPinDrop), or uses where they're standing.
 */
export function ManualPinPrompt() {
  const pending = usePhotoPins((s) => s.pending);
  const placePending = usePhotoPins((s) => s.placePending);
  const cancelPending = usePhotoPins((s) => s.cancelPending);
  const thumb = usePhotoUrl(pending?.photoId, 'thumb');
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!pending) return null;

  async function useMyLocation() {
    setLocating(true);
    setError(null);
    const fix = await getDeviceFix();
    setLocating(false);
    if (!fix) {
      setError("Couldn't get your location. Tap the map instead.");
      return;
    }
    await placePending(fix.position, 'device-gps');
  }

  return (
    <div className="manual-pin" role="dialog" aria-label="Place photo on map">
      {thumb && <img className="manual-pin__thumb" src={thumb} alt="" />}
      <div className="manual-pin__body">
        <strong>No location in this photo</strong>
        <span>Tap the map where you took it.</span>
        {error && <span className="manual-pin__error">{error}</span>}
      </div>
      <div className="manual-pin__actions">
        <button type="button" onClick={() => void useMyLocation()} disabled={locating}>
          {locating ? 'Locating…' : 'Use my location'}
        </button>
        <button type="button" className="is-quiet" onClick={() => void cancelPending()}>
          Cancel
        </button>
      </div>
    </div>
  );
}
