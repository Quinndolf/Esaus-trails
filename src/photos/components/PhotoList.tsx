import { useMemo, useState } from 'react';
import { usePhotoPins } from '../store';
import type { PhotoPin } from '../types';
import { usePhotoUrl } from '../usePhotoUrl';
import { Toggle } from './Toggle';

interface PhotoListProps {
  /** Called when a pin is picked, so the map can fly to it. */
  onPick?(pin: PhotoPin): void;
}

/** All photo pins, filterable by tag, plus the upload setting. */
export function PhotoList({ onPick }: PhotoListProps) {
  const pins = usePhotoPins((s) => s.pins);
  const select = usePhotoPins((s) => s.select);
  const uploadEnabled = usePhotoPins((s) => s.uploadEnabled);
  const setUploadEnabled = usePhotoPins((s) => s.setUploadEnabled);
  const [tag, setTag] = useState<string | null>(null);

  const tags = useMemo(() => [...new Set(pins.flatMap((p) => p.tags))].sort(), [pins]);
  const shown = tag ? pins.filter((p) => p.tags.includes(tag)) : pins;

  return (
    <section className="photo-list" aria-label="Photos">
      <div className="photo-list__setting">
        <div>
          <strong>Back up photos to server</strong>
          <small>Off keeps every photo on this phone only.</small>
        </div>
        <Toggle checked={uploadEnabled} onChange={(v) => void setUploadEnabled(v)} label="Back up photos to server" />
      </div>

      {tags.length > 0 && (
        <div className="photo-list__filters">
          <button type="button" className={`chip${tag === null ? ' is-on' : ''}`} onClick={() => setTag(null)}>
            all
          </button>
          {tags.map((t) => (
            <button key={t} type="button" className={`chip${tag === t ? ' is-on' : ''}`} onClick={() => setTag(t)}>
              {t}
            </button>
          ))}
        </div>
      )}

      {shown.length === 0 ? (
        <p className="photo-list__empty">No photos yet. Take one or pick from your camera roll.</p>
      ) : (
        <ul>
          {shown.map((pin) => (
            <li key={pin.id}>
              <button
                type="button"
                className="photo-row"
                onClick={() => {
                  select(pin.id);
                  onPick?.(pin);
                }}
              >
                <Thumb photoId={pin.photoId} />
                <span className="photo-row__text">
                  <strong>{pin.name}</strong>
                  <small className={pin.tags.length ? 'photo-row__tags' : undefined}>{pin.tags.join(' · ') || 'No tags'}</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Thumb({ photoId }: { photoId: string }) {
  const url = usePhotoUrl(photoId, 'thumb');
  return <span className="photo-row__thumb" style={url ? { backgroundImage: `url("${url}")` } : undefined} />;
}
