import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Shape, Track, Waypoint } from './types';

/** Waypoints, shapes and tracks live on the phone in IndexedDB so they work with no service. */
interface ToolsSchema extends DBSchema {
  waypoints: { key: string; value: Waypoint };
  shapes: { key: string; value: Shape };
  tracks: { key: string; value: Track };
}

const DB_NAME = 'esau-tools';
let dbPromise: Promise<IDBPDatabase<ToolsSchema>> | null = null;

function db() {
  dbPromise ??= openDB<ToolsSchema>(DB_NAME, 1, {
    upgrade(d) {
      d.createObjectStore('waypoints', { keyPath: 'id' });
      d.createObjectStore('shapes', { keyPath: 'id' });
      d.createObjectStore('tracks', { keyPath: 'id' });
    },
  });
  return dbPromise;
}

type Store = 'waypoints' | 'shapes' | 'tracks';

export async function put<S extends Store>(store: S, value: ToolsSchema[S]['value']): Promise<void> {
  await (await db()).put(store, value);
}

export async function all<S extends Store>(store: S): Promise<ToolsSchema[S]['value'][]> {
  return (await db()).getAll(store);
}

export async function remove(store: Store, id: string): Promise<void> {
  await (await db()).delete(store, id);
}

/** Test hook: drop the cached connection so each test gets a fresh database. */
export async function _resetToolsDbForTests(): Promise<void> {
  if (dbPromise) (await dbPromise).close();
  dbPromise = null;
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  });
}
