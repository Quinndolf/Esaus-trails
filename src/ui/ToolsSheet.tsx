import { usePhotoPins } from '../photos/store';
import { useTools } from '../tools/store';
import { CallButton } from '../calls/CallButton';
import { BottomSheet } from './BottomSheet';

interface Props {
  open: boolean;
  onClose: () => void;
  onPhotos: () => void;
  onMarkLocation: () => void;
  onSaved: () => void;
  onCalls: () => void;
  /** Animal-specific tiles show only when the hunted animal has them (calls). */
  hasCalls: boolean;
  callsHint: string;
  /** Opens the "Did you snag anything?" question. */
  onDone: () => void;
}

/** The Swiss-army knife: every map tool in one sheet. */
export function ToolsSheet({ open, onClose, onPhotos, onMarkLocation, onSaved, onCalls, hasCalls, callsHint, onDone }: Props) {
  const setMode = useTools((s) => s.setMode);
  const recording = useTools((s) => s.recording);
  const startTrack = useTools((s) => s.startTrack);
  const stopTrack = useTools((s) => s.stopTrack);
  const counts = useTools((s) => s.waypoints.length + s.shapes.length + s.tracks.length) + usePhotoPins((s) => s.pins.length);

  const pick = (fn: () => void) => () => {
    fn();
    onClose();
  };

  const tools = [
    { id: 'mark', name: 'Mark my location', hint: 'Red X where you stand', run: pick(onMarkLocation), primary: true },
    { id: 'drop', name: 'Drop waypoint', hint: 'Tap the map to place it', run: pick(() => setMode('drop-waypoint')) },
    { id: 'saved', name: 'My Marks', hint: counts ? `${counts} saved` : 'Waypoints, photos, tracks', run: onSaved },
    { id: 'photos', name: 'Photos', hint: 'Take or add a photo', run: onPhotos },
    ...(hasCalls ? [{ id: 'calls', name: 'Calls', hint: callsHint, run: onCalls }] : []),
    { id: 'measure', name: 'Measure distance', hint: 'Tap points on the map', run: pick(() => setMode('measure')) },
    { id: 'line', name: 'Draw line', hint: 'Routes, fence lines', run: pick(() => setMode('draw-line')) },
    { id: 'area', name: 'Draw area', hint: 'Plots, fields, acreage', run: pick(() => setMode('draw-area')) },
    recording
      ? { id: 'track', name: 'Stop tracker', hint: 'Save the route', run: pick(() => void stopTrack()), live: true }
      : { id: 'track', name: 'Tracker', hint: 'Record your route', run: pick(startTrack) },
    { id: 'done', name: 'Done hunting', hint: 'Did you snag anything?', run: pick(onDone) },
  ];

  return (
    <BottomSheet title="Tools" open={open} onClose={onClose}>
      {hasCalls && (
        <div className="tool-call">
          <CallButton />
        </div>
      )}
      <div className="tool-grid">
        {tools.map((t) => (
          <button
            key={t.id}
            className={`tool-tile ${'primary' in t && t.primary ? 'is-primary' : ''} ${'live' in t && t.live ? 'is-live' : ''}`}
            onClick={t.run}
          >
            {t.name}
            <span className="hint">{t.hint}</span>
          </button>
        ))}
      </div>
    </BottomSheet>
  );
}
