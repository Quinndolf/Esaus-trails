/** Tags a hunter can put on a photo pin. Custom tags are allowed too. */
export const PRESET_TAGS = ['bedding', 'food', 'trail', 'rub', 'scrape', 'sign'] as const;
export type PresetTag = (typeof PRESET_TAGS)[number];

export interface LngLat {
  lng: number;
  lat: number;
}

/** What we could pull out of a photo's EXIF block. Any field may be missing. */
export interface PhotoMeta {
  position: LngLat | null;
  /** Meters above sea level, negative below. */
  altitude: number | null;
  /** When the shutter fired, as an ISO string. */
  takenAt: string | null;
  /** Compass heading the camera faced, degrees true, if the phone recorded it. */
  heading: number | null;
  width: number | null;
  height: number | null;
}

/** Where a pin's location came from, so the UI and Esau know how far to trust it. */
export type PinSource = 'exif' | 'device-gps' | 'manual';

export type UploadState = 'local-only' | 'queued' | 'uploaded' | 'failed';

export interface PhotoPin {
  id: string;
  /** Key of the image blob in the photo store. */
  photoId: string;
  name: string;
  notes: string;
  tags: string[];
  position: LngLat;
  altitude: number | null;
  takenAt: string | null;
  heading: number | null;
  source: PinSource;
  createdAt: string;
  updatedAt: string;
  upload: UploadState;
}

/** A photo that has been saved but has no location yet: the hunter must drop it on the map. */
export interface PendingPhoto {
  photoId: string;
  fileName: string;
  meta: PhotoMeta;
}

export interface StoredPhoto {
  id: string;
  blob: Blob;
  thumb: Blob | null;
  mimeType: string;
  fileName: string;
  createdAt: string;
}
