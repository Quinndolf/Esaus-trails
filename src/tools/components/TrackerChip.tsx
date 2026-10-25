import { useEffect, useState } from 'react';
import { formatDistance, formatDuration } from '../../map/geo';
import { useTools } from '../store';

/** Shows while a route is recording: elapsed time, distance and a stop button. */
export function TrackerChip() {
  const recording = useTools((s) => s.recording);
  const stopTrack = useTools((s) => s.stopTrack);
  const [, tick] = useState(0);

  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);

  if (!recording) return null;
  return (
    <div className="tracker-chip" data-testid="tracker">
      <span className="rec-dot" />
      <span>{formatDuration(Date.now() - recording.startedAt)}</span>
      <span>{formatDistance(recording.distance)}</span>
      <button className="text-btn" onClick={() => void stopTrack()}>
        Stop
      </button>
    </div>
  );
}
