import { useRef, useState } from 'react';
import { signFits } from '../../esau/species';
import { useEsau } from '../../esau/ui/store';
import { metersToFeet } from '../../map/geo';
import { usePhotoUrl } from '../../photos/usePhotoUrl';
import { BottomSheet } from '../../ui/BottomSheet';
import { ICON_COLORS, ICON_LABELS, iconSvg } from '../icons';
import { useTools } from '../store';
import { WAYPOINT_ICONS, type Waypoint } from '../types';

/** Edit the selected waypoint: name, icon, notes, photos. */
export function WaypointSheet() {
  const wp = useTools((s) => s.waypoints.find((w) => w.id === s.selectedWaypointId) ?? null);
  if (!wp) return null;
  return <Editor key={wp.id} wp={wp} />;
}

function Editor({ wp }: { wp: Waypoint }) {
  const species = useEsau((st) => st.species);
  const { updateWaypoint, removeWaypoint, selectWaypoint, addWaypointPhoto, removeWaypointPhoto } = useTools.getState();
  const [name, setName] = useState(wp.name);
  const [notes, setNotes] = useState(wp.notes);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);
  const camera = useRef<HTMLInputElement>(null);
  const roll = useRef<HTMLInputElement>(null);

  const saveText = () => {
    if (name !== wp.name || notes !== wp.notes) void updateWaypoint(wp.id, { name: name.trim() || wp.name, notes });
  };
  const close = () => {
    saveText();
    selectWaypoint(null);
  };
  const onFiles = async (input: HTMLInputElement) => {
    const files = Array.from(input.files ?? []);
    input.value = '';
    for (const f of files) await addWaypointPhoto(wp.id, f);
  };

  return (
    <BottomSheet title="Waypoint" open onClose={close}>
      <input className="text-input wp-name" value={name} onChange={(e) => setName(e.target.value)} onBlur={saveText} aria-label="Waypoint name" />

      <h3 className="sheet-section">Icon</h3>
      <div className="icon-grid" role="radiogroup" aria-label="Icon">
        {WAYPOINT_ICONS.filter((icon) => icon === wp.icon || signFits(icon, species)).map((icon) => (
          <button
            key={icon}
            role="radio"
            aria-checked={wp.icon === icon}
            aria-label={ICON_LABELS[icon]}
            title={ICON_LABELS[icon]}
            className={`icon-choice ${wp.icon === icon ? 'is-on' : ''}`}
            style={{ ['--wp-color' as string]: ICON_COLORS[icon] }}
            onClick={() => void updateWaypoint(wp.id, { icon })}
            dangerouslySetInnerHTML={{ __html: iconSvg(icon) }}
          />
        ))}
      </div>

      <h3 className="sheet-section">Notes</h3>
      <textarea
        className="text-input"
        rows={3}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={saveText}
        placeholder="What you saw, wind, sign, stand access…"
        aria-label="Notes"
      />

      <h3 className="sheet-section">Photos</h3>
      <div className="wp-photos">
        {wp.photoIds.map((id) => (
          <Thumb key={id} photoId={id} onOpen={() => setViewing(id)} onRemove={() => void removeWaypointPhoto(wp.id, id)} />
        ))}
        <button className="wp-photo-add" onClick={() => camera.current?.click()}>
          Take photo
        </button>
        <button className="wp-photo-add" onClick={() => roll.current?.click()}>
          From camera roll
        </button>
        <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => void onFiles(e.currentTarget)} />
        <input ref={roll} type="file" accept="image/*" multiple hidden onChange={(e) => void onFiles(e.currentTarget)} />
      </div>

      <dl className="wp-meta">
        <dt>Location</dt>
        <dd>
          {wp.position[1].toFixed(5)}, {wp.position[0].toFixed(5)}
        </dd>
        {wp.altitude != null && (
          <>
            <dt>Elevation</dt>
            <dd>{Math.round(metersToFeet(wp.altitude)).toLocaleString()} ft</dd>
          </>
        )}
        <dt>Marked</dt>
        <dd>{new Date(wp.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</dd>
      </dl>

      {confirmDelete ? (
        <div className="confirm-row">
          <span>Delete this waypoint{wp.photoIds.length ? ' and its photos' : ''}?</span>
          <button className="chip-btn is-danger" onClick={() => void removeWaypoint(wp.id)}>
            Delete
          </button>
          <button className="chip-btn" onClick={() => setConfirmDelete(false)}>
            Keep
          </button>
        </div>
      ) : (
        <button className="text-btn danger" onClick={() => setConfirmDelete(true)}>
          Delete waypoint
        </button>
      )}

      {viewing && <Lightbox photoId={viewing} onClose={() => setViewing(null)} />}
    </BottomSheet>
  );
}

function Thumb({ photoId, onOpen, onRemove }: { photoId: string; onOpen: () => void; onRemove: () => void }) {
  const url = usePhotoUrl(photoId, 'thumb');
  return (
    <div className="wp-photo">
      <button className="wp-photo-img" style={url ? { backgroundImage: `url("${url}")` } : undefined} onClick={onOpen} aria-label="Open photo" />
      <button className="wp-photo-remove" onClick={onRemove} aria-label="Remove photo">
        ×
      </button>
    </div>
  );
}

function Lightbox({ photoId, onClose }: { photoId: string; onClose: () => void }) {
  const url = usePhotoUrl(photoId);
  return (
    <div className="lightbox" onClick={onClose} role="dialog" aria-label="Photo">
      {url && <img src={url} alt="" />}
    </div>
  );
}
