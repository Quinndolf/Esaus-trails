import { useRef, useState, type ReactNode } from 'react';
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

export interface PhotoPicker {
  takePhoto(): void;
  chooseFromRoll(): void;
  busy: boolean;
  /** Hidden file inputs; render these somewhere that stays mounted while a photo is being added. */
  inputs: ReactNode;
}

/**
 * Two ways in: shoot a photo now, or pick from the camera roll.
 * The camera input uses `capture` so phones open straight to the camera.
 * `onPicked` runs once files are chosen, e.g. to close a sheet so the
 * hunter can see the map if a photo needs placing by hand.
 */
export function usePhotoPicker(onPicked?: () => void): PhotoPicker {
  const addPhoto = usePhotoPins((s) => s.addPhoto);
  const cameraInput = useRef<HTMLInputElement>(null);
  const rollInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleFiles(input: HTMLInputElement, capturedNow: boolean) {
    // Copy before clearing: the FileList is live and empties with the input.
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (!files.length) return;
    onPicked?.();
    setBusy(true);
    try {
      // Get the fix while the photo is fresh; it's only used if EXIF has no GPS.
      const fix = capturedNow ? await getDeviceFix() : null;
      // Several from the roll are added one at a time; any without GPS
      // waits its turn for a manual drop.
      for (const file of files) {
        const result = await addPhoto(file, {
          capturedNow,
          devicePosition: fix?.position,
          deviceAltitude: fix?.altitude,
        });
        if (result.kind === 'needs-location') await waitForPendingToClear();
      }
    } finally {
      setBusy(false);
    }
  }

  return {
    takePhoto: () => cameraInput.current?.click(),
    chooseFromRoll: () => rollInput.current?.click(),
    busy,
    inputs: (
      <>
        <input
          ref={cameraInput}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => void handleFiles(e.currentTarget, true)}
        />
        <input
          ref={rollInput}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => void handleFiles(e.currentTarget, false)}
        />
      </>
    ),
  };
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
