import { useState } from 'react';
import { BottomSheet } from '../../ui/BottomSheet';
import { buildEsauPhotoInput, type EsauPhotoInput } from '../esauPhotoInput';
import { normalizeTags, usePhotoPins } from '../store';
import { PRESET_TAGS, type PhotoPin } from '../types';
import { usePhotoUrl } from '../usePhotoUrl';

interface PhotoPinSheetProps {
  /** Hands the photo and its location to Esau. Wired up by the Esau module. */
  onAskEsau?(input: EsauPhotoInput): void;
}

const SOURCE_LABEL: Record<PhotoPin['source'], string> = {
  exif: 'From photo GPS',
  'device-gps': 'From your GPS when taken',
  manual: 'Placed by hand',
};

/** Bottom sheet for the selected photo pin: view, name, notes, tags. */
export function PhotoPinSheet({ onAskEsau }: PhotoPinSheetProps) {
  const pin = usePhotoPins((s) => s.pins.find((p) => p.id === s.selectedPinId) ?? null);
  if (!pin) return null;
  // Keyed so the draft resets when a different pin is opened.
  return <PinEditor key={pin.id} pin={pin} onAskEsau={onAskEsau} />;
}

function PinEditor({ pin, onAskEsau }: { pin: PhotoPin } & PhotoPinSheetProps) {
  const updatePin = usePhotoPins((s) => s.updatePin);
  const removePin = usePhotoPins((s) => s.removePin);
  const select = usePhotoPins((s) => s.select);
  const image = usePhotoUrl(pin.photoId);
  const [name, setName] = useState(pin.name);
  const [notes, setNotes] = useState(pin.notes);
  const [customTag, setCustomTag] = useState('');
  const [asking, setAsking] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const saveText = () => {
    if (name !== pin.name || notes !== pin.notes) {
      void updatePin(pin.id, { name: name.trim() || pin.name, notes });
    }
  };

  const toggleTag = (tag: string) => {
    const tags = pin.tags.includes(tag) ? pin.tags.filter((t) => t !== tag) : [...pin.tags, tag];
    void updatePin(pin.id, { tags });
  };

  const addCustomTag = () => {
    const [tag] = normalizeTags([customTag]);
    if (tag && !pin.tags.includes(tag)) void updatePin(pin.id, { tags: [...pin.tags, tag] });
    setCustomTag('');
  };

  const close = () => {
    saveText();
    select(null);
  };

  const askEsau = async () => {
    if (!onAskEsau) return;
    saveText();
    setAsking(true);
    try {
      onAskEsau(await buildEsauPhotoInput({ ...pin, name, notes }));
    } finally {
      setAsking(false);
    }
  };

  const allTags = [...PRESET_TAGS, ...pin.tags.filter((t) => !(PRESET_TAGS as readonly string[]).includes(t))];

  return (
    <BottomSheet title="Photo" open onClose={close}>
      <div className="photo-sheet">
      <input
        className="photo-sheet__name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={saveText}
        aria-label="Name"
      />

      {image && <img className="photo-sheet__image" src={image} alt={pin.name} />}

      {onAskEsau && (
        <button type="button" className="photo-sheet__esau" onClick={() => void askEsau()} disabled={asking}>
          {asking ? 'Getting the photo ready…' : 'Ask Esau about this photo'}
        </button>
      )}

      <div className="photo-sheet__tags" role="group" aria-label="Tags">
        {allTags.map((tag) => (
          <button
            key={tag}
            type="button"
            className={`chip${pin.tags.includes(tag) ? ' is-on' : ''}`}
            aria-pressed={pin.tags.includes(tag)}
            onClick={() => toggleTag(tag)}
          >
            {tag}
          </button>
        ))}
        <form
          className="chip-add"
          onSubmit={(e) => {
            e.preventDefault();
            addCustomTag();
          }}
        >
          <input value={customTag} onChange={(e) => setCustomTag(e.target.value)} placeholder="+ tag" aria-label="Add tag" />
        </form>
      </div>

      <textarea
        className="photo-sheet__notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={saveText}
        placeholder="Notes: what you saw, wind, sign…"
        rows={3}
        aria-label="Notes"
      />

      <dl className="photo-sheet__meta">
        <dt>Location</dt>
        <dd>
          {pin.position.lat.toFixed(5)}, {pin.position.lng.toFixed(5)}
          <small>{SOURCE_LABEL[pin.source]}</small>
        </dd>
        {pin.altitude !== null && (
          <>
            <dt>Elevation</dt>
            <dd>{Math.round(pin.altitude * 3.28084).toLocaleString()} ft</dd>
          </>
        )}
        {pin.takenAt && (
          <>
            <dt>Taken</dt>
            <dd>{new Date(pin.takenAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</dd>
          </>
        )}
        {pin.heading !== null && (
          <>
            <dt>Facing</dt>
            <dd>{Math.round(pin.heading)}°</dd>
          </>
        )}
        <dt>Stored</dt>
        <dd>{pin.upload === 'uploaded' ? 'On this phone and uploaded' : pin.upload === 'queued' ? 'On this phone, uploading' : pin.upload === 'failed' ? 'On this phone, upload failed' : 'On this phone only'}</dd>
      </dl>

      {confirmDelete ? (
        <div className="photo-sheet__confirm">
          <span>Delete this photo and pin?</span>
          <button type="button" className="is-danger" onClick={() => void removePin(pin.id)}>
            Delete
          </button>
          <button type="button" className="is-quiet" onClick={() => setConfirmDelete(false)}>
            Keep
          </button>
        </div>
      ) : (
        <button type="button" className="is-quiet is-danger-text" onClick={() => setConfirmDelete(true)}>
          Delete photo
        </button>
      )}
      </div>
    </BottomSheet>
  );
}
