import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { PhotoPin, StoredPhoto } from './types';

/**
 * On-device storage for photos and their pins. Everything lives in IndexedDB
 * so it survives reloads and works with no service. Nothing leaves the phone
 * unless the hunter turns on uploads.
 */
interface PhotoSchema extends DBSchema {
  photos: { key: string; value: StoredPhoto };
  pins: { key: string; value: PhotoPin; indexes: { byPhoto: string } };
}

const DB_NAME = 'esau-photos';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<PhotoSchema>> | null = null;

function db() {
  dbPromise ??= openDB<PhotoSchema>(DB_NAME, DB_VERSION, {
    upgrade(d) {
      d.createObjectStore('photos', { keyPath: 'id' });
      const pins = d.createObjectStore('pins', { keyPath: 'id' });
      pins.createIndex('byPhoto', 'photoId');
    },
  });
  return dbPromise;
}

export async function savePhoto(photo: StoredPhoto): Promise<void> {
  await (await db()).put('photos', photo);
}

export async function getPhoto(id: string): Promise<StoredPhoto | undefined> {
  return (await db()).get('photos', id);
}

export async function deletePhoto(id: string): Promise<void> {
  await (await db()).delete('photos', id);
}

export async function savePin(pin: PhotoPin): Promise<void> {
  await (await db()).put('pins', pin);
}

export async function listPins(): Promise<PhotoPin[]> {
  const pins = await (await db()).getAll('pins');
  return pins.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Deletes a pin and its photo together so no orphaned images pile up on the phone. */
export async function deletePinAndPhoto(pin: PhotoPin): Promise<void> {
  const tx = (await db()).transaction(['pins', 'photos'], 'readwrite');
  await Promise.all([tx.objectStore('pins').delete(pin.id), tx.objectStore('photos').delete(pin.photoId), tx.done]);
}

/** Asks the browser not to evict our data under storage pressure. Best effort. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

/** Test hook: drop the cached connection so each test gets a fresh database. */
export async function _resetDbForTests(): Promise<void> {
  if (dbPromise) (await dbPromise).close();
  dbPromise = null;
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  });
}
