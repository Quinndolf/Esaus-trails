import type { PhotoPin, StoredPhoto } from './types';

/**
 * Optional server upload. Off by default. The app has no backend yet, so the
 * uploader is injected: when the backend exists, call `setPhotoUploader` with
 * one that posts to it. Until then turning uploads on just queues pins.
 */
export interface PhotoUploader {
  upload(pin: PhotoPin, photo: StoredPhoto): Promise<void>;
}

let uploader: PhotoUploader | null = null;

export function setPhotoUploader(next: PhotoUploader | null) {
  uploader = next;
}

export function getPhotoUploader(): PhotoUploader | null {
  return uploader;
}

/** A basic uploader for a multipart endpoint, for when the backend lands. */
export function httpUploader(endpoint: string, headers: Record<string, string> = {}): PhotoUploader {
  return {
    async upload(pin, photo) {
      const body = new FormData();
      body.append('pin', JSON.stringify(pin));
      body.append('photo', photo.blob, photo.fileName);
      const res = await fetch(endpoint, { method: 'POST', body, headers });
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
    },
  };
}
