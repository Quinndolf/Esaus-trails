import { create } from 'zustand';
import { readPhotoMeta } from './exif';
import * as photoDb from './photoDb';
import { makeThumbnail } from './thumbnail';
import { getPhotoUploader } from './upload';
import type { LngLat, PendingPhoto, PhotoMeta, PhotoPin, PinSource } from './types';

const UPLOAD_PREF_KEY = 'esau.photos.uploadEnabled';

export type AddPhotoResult = { kind: 'placed'; pin: PhotoPin } | { kind: 'needs-location'; pending: PendingPhoto };

export interface AddPhotoOptions {
  /**
   * The photo was just taken in the app. If it has no GPS in its EXIF (common:
   * many browsers strip it from camera captures), the hunter is standing where
   * it was taken, so the device's current fix is a fair location.
   */
  capturedNow?: boolean;
  devicePosition?: LngLat | null;
  deviceAltitude?: number | null;
}

export type PinPatch = Partial<Pick<PhotoPin, 'name' | 'notes' | 'tags' | 'position'>>;

interface PhotoPinState {
  pins: PhotoPin[];
  loaded: boolean;
  /** A saved photo waiting for the hunter to drop its pin on the map. */
  pending: PendingPhoto | null;
  selectedPinId: string | null;
  uploadEnabled: boolean;

  load(): Promise<void>;
  addPhoto(file: File, opts?: AddPhotoOptions): Promise<AddPhotoResult>;
  placePending(position: LngLat, source?: PinSource): Promise<PhotoPin | null>;
  cancelPending(): Promise<void>;
  updatePin(id: string, patch: PinPatch): Promise<void>;
  removePin(id: string): Promise<void>;
  select(id: string | null): void;
  setUploadEnabled(enabled: boolean): Promise<void>;
  flushUploads(): Promise<void>;
}

export const usePhotoPins = create<PhotoPinState>((set, get) => ({
  pins: [],
  loaded: false,
  pending: null,
  selectedPinId: null,
  uploadEnabled: readUploadPref(),

  async load() {
    const pins = await photoDb.listPins();
    set({ pins, loaded: true });
    void photoDb.requestPersistentStorage();
  },

  async addPhoto(file, opts = {}) {
    const meta = await readPhotoMeta(file);
    const photoId = newId();
    await photoDb.savePhoto({
      id: photoId,
      blob: file,
      thumb: await makeThumbnail(file),
      mimeType: file.type || 'image/jpeg',
      fileName: file.name || 'photo.jpg',
      createdAt: new Date().toISOString(),
    });

    if (meta.position) {
      return { kind: 'placed', pin: await commitPin(photoId, file.name, meta, meta.position, 'exif') };
    }
    if (opts.capturedNow && opts.devicePosition) {
      const withAlt = { ...meta, altitude: meta.altitude ?? opts.deviceAltitude ?? null };
      return { kind: 'placed', pin: await commitPin(photoId, file.name, withAlt, opts.devicePosition, 'device-gps') };
    }

    const pending: PendingPhoto = { photoId, fileName: file.name, meta };
    set({ pending });
    return { kind: 'needs-location', pending };
  },

  async placePending(position, source = 'manual') {
    const { pending } = get();
    if (!pending) return null;
    set({ pending: null });
    return commitPin(pending.photoId, pending.fileName, pending.meta, position, source);
  },

  async cancelPending() {
    const { pending } = get();
    if (!pending) return;
    set({ pending: null });
    await photoDb.deletePhoto(pending.photoId);
  },

  async updatePin(id, patch) {
    const current = get().pins.find((p) => p.id === id);
    if (!current) return;
    const next: PhotoPin = {
      ...current,
      ...patch,
      tags: patch.tags ? normalizeTags(patch.tags) : current.tags,
      // A pin the hunter dragged is now a manual placement.
      source: patch.position ? 'manual' : current.source,
      updatedAt: new Date().toISOString(),
      // Edits need to go up again if uploads are on.
      upload: current.upload === 'uploaded' && get().uploadEnabled ? 'queued' : current.upload,
    };
    await photoDb.savePin(next);
    set({ pins: get().pins.map((p) => (p.id === id ? next : p)) });
    if (next.upload === 'queued') void get().flushUploads();
  },

  async removePin(id) {
    const pin = get().pins.find((p) => p.id === id);
    if (!pin) return;
    await photoDb.deletePinAndPhoto(pin);
    set({
      pins: get().pins.filter((p) => p.id !== id),
      selectedPinId: get().selectedPinId === id ? null : get().selectedPinId,
    });
  },

  select(id) {
    set({ selectedPinId: id });
  },

  async setUploadEnabled(enabled) {
    writeUploadPref(enabled);
    set({ uploadEnabled: enabled });
    // Turning uploads off leaves anything already uploaded alone; it just stops sending more.
    const pins = get().pins.map((p): PhotoPin => {
      if (enabled && (p.upload === 'local-only' || p.upload === 'failed')) return { ...p, upload: 'queued' };
      if (!enabled && p.upload === 'queued') return { ...p, upload: 'local-only' };
      return p;
    });
    await Promise.all(pins.filter((p, i) => p !== get().pins[i]).map(photoDb.savePin));
    set({ pins });
    if (enabled) await get().flushUploads();
  },

  async flushUploads() {
    const uploader = getPhotoUploader();
    if (!uploader || !get().uploadEnabled) return;
    for (const pin of get().pins.filter((p) => p.upload === 'queued')) {
      const photo = await photoDb.getPhoto(pin.photoId);
      if (!photo) continue;
      let upload: PhotoPin['upload'];
      try {
        await uploader.upload(pin, photo);
        upload = 'uploaded';
      } catch {
        upload = 'failed';
      }
      const latest = get().pins.find((p) => p.id === pin.id);
      if (!latest) continue;
      const next = { ...latest, upload };
      await photoDb.savePin(next);
      set({ pins: get().pins.map((p) => (p.id === pin.id ? next : p)) });
    }
  },
}));

async function commitPin(
  photoId: string,
  fileName: string,
  meta: PhotoMeta,
  position: LngLat,
  source: PinSource,
): Promise<PhotoPin> {
  const now = new Date().toISOString();
  const state = usePhotoPins.getState();
  const pin: PhotoPin = {
    id: newId(),
    photoId,
    name: defaultName(meta.takenAt ?? now, fileName),
    notes: '',
    tags: [],
    position,
    altitude: meta.altitude,
    takenAt: meta.takenAt,
    heading: meta.heading,
    source,
    createdAt: now,
    updatedAt: now,
    upload: state.uploadEnabled ? 'queued' : 'local-only',
  };
  await photoDb.savePin(pin);
  usePhotoPins.setState({ pins: [pin, ...usePhotoPins.getState().pins], selectedPinId: pin.id });
  if (pin.upload === 'queued') void usePhotoPins.getState().flushUploads();
  return pin;
}

export function defaultName(iso: string, fileName = ''): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return fileName.replace(/\.[^.]+$/, '') || 'Photo';
  const date = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `Photo ${date}, ${time}`;
}

export function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  for (const t of tags) {
    const clean = t.trim().toLowerCase();
    if (clean) seen.add(clean);
  }
  return [...seen];
}

function newId(): string {
  return crypto.randomUUID();
}

function readUploadPref(): boolean {
  try {
    return localStorage.getItem(UPLOAD_PREF_KEY) === 'true';
  } catch {
    return false;
  }
}

function writeUploadPref(enabled: boolean) {
  try {
    localStorage.setItem(UPLOAD_PREF_KEY, String(enabled));
  } catch {
    /* private mode: the toggle still works for this session */
  }
}
