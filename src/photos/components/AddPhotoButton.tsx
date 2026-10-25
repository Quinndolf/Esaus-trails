import { useRef, useState } from 'react';
import { usePhotoPins } from '../store';
import type { LngLat } from '../types';

interface DeviceFix {
  position: LngLat;
  altitude: number | null;
}

/** Current GPS fix, or null if the hunter said no or there's no signal. */
export function getDeviceFix(timeoutMs = 8000): Promise<DeviceFix | null> {
  if (!('geolocation' in navigator)) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) =>
        resolve({
          position: { lat: p.coords.latitude, lng: p.coords.longitude },
          altitude: p.coords.altitude,
        }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30_000 },
    );
  });
}

/**
 * Two ways in: shoot a photo now, or pick one from the camera roll.
 * The camera input uses `capture` so phones open straight to the camera.
 */
export function AddPhotoButton() {
  const addPhoto = usePhotoPins((s) => s.addPhoto);
  const cameraInput = useRef<HTMLInputElement>(null);
  const rollInput = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleFiles(files: FileList | null, capturedNow: boolean) {
    if (!files?.length) return;
    setOpen(false);
    setBusy(true);
    try {
      // Get the fix while the photo is fresh; it's only used if EXIF has no GPS.
      const fix = capturedNow ? await getDeviceFix() : null;
      // Several from the roll are added one at a time; any without GPS
      // waits its turn for a manual drop.
      for (const file of Array.from(files)) {
        const result = await addPhoto(file, {
          capturedNow,
          devicePosition: fix?.position,
          deviceAltitude: fix?.altitude,
        });
        if (result.kind === 'needs-location') await waitForPendingToClear();
      }
    } finally {
      setBusy(false);
      if (cameraInput.current) cameraInput.current.value = '';
      if (rollInput.current) rollInput.current.value = '';
    }
  }

  return (
    <div className="photo-add">
      {open && (
        <div className="photo-add__menu" role="menu">
          <button type="button" role="menuitem" onClick={() => cameraInput.current?.click()}>
            Take photo
          </button>
          <button type="button" role="menuitem" onClick={() => rollInput.current?.click()}>
            Choose from camera roll
          </button>
        </div>
      )}
      <button
        type="button"
        className="map-fab"
        aria-label="Add photo"
        aria-expanded={open}
        disabled={busy}
        onClick={() => setOpen((o) => !o)}
      >
        {busy ? '…' : <CameraIcon />}
      </button>
      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => void handleFiles(e.target.files, true)}
      />
      <input
        ref={rollInput}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => void handleFiles(e.target.files, false)}
      />
    </div>
  );
}

function waitForPendingToClear(): Promise<void> {
  return new Promise((resolve) => {
    const unsub = usePhotoPins.subscribe((s) => {
      if (!s.pending) {
        unsub();
        resolve();
      }
    });
  });
}

function CameraIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13.5" r="3.5" />
    </svg>
  );
}
