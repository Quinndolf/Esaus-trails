import { create } from 'zustand';
import { distance, pathLength, type LngLat } from '../map/geo';
import { deletePhoto, savePhoto } from '../photos/photoDb';
import { makeThumbnail } from '../photos/thumbnail';
import * as db from './db';
import type { Shape, ShapeKind, ToolMode, Track, TrackPoint, Waypoint, WaypointIcon } from './types';

/** GPS fixes worse than this are too jumpy to add to a recorded route. */
const TRACK_MAX_ACCURACY_M = 35;
/** Ignore jitter while standing still. */
const TRACK_MIN_STEP_M = 4;

export type WaypointPatch = Partial<Pick<Waypoint, 'name' | 'icon' | 'notes' | 'position'>>;

interface Recording {
  startedAt: number;
  points: TrackPoint[];
  distance: number;
}

interface ToolsState {
  loaded: boolean;
  waypoints: Waypoint[];
  shapes: Shape[];
  tracks: Track[];

  mode: ToolMode;
  /** Points tapped so far while measuring or drawing. */
  draft: LngLat[];
  selectedWaypointId: string | null;
  recording: Recording | null;

  load(): Promise<void>;

  addWaypoint(input: { position: LngLat; altitude?: number | null; icon?: WaypointIcon; name?: string }): Promise<Waypoint>;
  updateWaypoint(id: string, patch: WaypointPatch): Promise<void>;
  addWaypointPhoto(id: string, file: File): Promise<void>;
  removeWaypointPhoto(id: string, photoId: string): Promise<void>;
  removeWaypoint(id: string): Promise<void>;
  selectWaypoint(id: string | null): void;

  setMode(mode: ToolMode): void;
  tapMap(at: LngLat): Promise<void>;
  undoPoint(): void;
  clearDraft(): void;
  saveDraft(name?: string): Promise<Shape | null>;
  removeShape(id: string): Promise<void>;
  renameShape(id: string, name: string): Promise<void>;

  startTrack(): void;
  addFix(fix: { lngLat: LngLat; accuracy: number; altitude: number | null; time: number }): void;
  stopTrack(): Promise<Track | null>;
  removeTrack(id: string): Promise<void>;
  renameTrack(id: string, name: string): Promise<void>;
}

const now = () => new Date().toISOString();
const newId = () => crypto.randomUUID();
const byNewest = <T extends { createdAt: string }>(a: T, b: T) => b.createdAt.localeCompare(a.createdAt);

export const useTools = create<ToolsState>((set, get) => ({
  loaded: false,
  waypoints: [],
  shapes: [],
  tracks: [],
  mode: 'none',
  draft: [],
  selectedWaypointId: null,
  recording: null,

  async load() {
    const [waypoints, shapes, tracks] = await Promise.all([db.all('waypoints'), db.all('shapes'), db.all('tracks')]);
    set({
      loaded: true,
      waypoints: waypoints.sort(byNewest),
      shapes: shapes.sort(byNewest),
      tracks: tracks.sort((a, b) => b.startedAt - a.startedAt),
    });
  },

  async addWaypoint({ position, altitude = null, icon = 'x', name }) {
    const stamp = now();
    const wp: Waypoint = {
      id: newId(),
      name: name ?? `Waypoint ${get().waypoints.length + 1}`,
      icon,
      notes: '',
      position,
      altitude,
      photoIds: [],
      createdAt: stamp,
      updatedAt: stamp,
    };
    await db.put('waypoints', wp);
    set({ waypoints: [wp, ...get().waypoints], selectedWaypointId: wp.id });
    return wp;
  },

  async updateWaypoint(id, patch) {
    const current = get().waypoints.find((w) => w.id === id);
    if (!current) return;
    const next: Waypoint = { ...current, ...patch, updatedAt: now() };
    await db.put('waypoints', next);
    set({ waypoints: get().waypoints.map((w) => (w.id === id ? next : w)) });
  },

  async addWaypointPhoto(id, file) {
    const current = get().waypoints.find((w) => w.id === id);
    if (!current) return;
    const photoId = newId();
    await savePhoto({
      id: photoId,
      blob: file,
      thumb: await makeThumbnail(file),
      mimeType: file.type || 'image/jpeg',
      fileName: file.name || 'photo.jpg',
      createdAt: now(),
    });
    const latest = get().waypoints.find((w) => w.id === id) ?? current;
    const next = { ...latest, photoIds: [...latest.photoIds, photoId], updatedAt: now() };
    await db.put('waypoints', next);
    set({ waypoints: get().waypoints.map((w) => (w.id === id ? next : w)) });
  },

  async removeWaypointPhoto(id, photoId) {
    const current = get().waypoints.find((w) => w.id === id);
    if (!current) return;
    const next = { ...current, photoIds: current.photoIds.filter((p) => p !== photoId), updatedAt: now() };
    await db.put('waypoints', next);
    await deletePhoto(photoId);
    set({ waypoints: get().waypoints.map((w) => (w.id === id ? next : w)) });
  },

  async removeWaypoint(id) {
    const wp = get().waypoints.find((w) => w.id === id);
    if (!wp) return;
    await db.remove('waypoints', id);
    await Promise.all(wp.photoIds.map(deletePhoto));
    set({
      waypoints: get().waypoints.filter((w) => w.id !== id),
      selectedWaypointId: get().selectedWaypointId === id ? null : get().selectedWaypointId,
    });
  },

  selectWaypoint(id) {
    set({ selectedWaypointId: id });
  },

  setMode(mode) {
    set({ mode, draft: [] });
  },

  async tapMap(at) {
    const { mode } = get();
    if (mode === 'drop-waypoint') {
      set({ mode: 'none' });
      await get().addWaypoint({ position: at, icon: 'flag' });
      return;
    }
    if (mode === 'measure' || mode === 'draw-line' || mode === 'draw-area') set({ draft: [...get().draft, at] });
  },

  undoPoint() {
    set({ draft: get().draft.slice(0, -1) });
  },

  clearDraft() {
    set({ draft: [] });
  },

  async saveDraft(name) {
    const { mode, draft, shapes } = get();
    const kind: ShapeKind | null = mode === 'draw-area' ? 'area' : mode === 'draw-line' || mode === 'measure' ? 'line' : null;
    if (!kind || draft.length < (kind === 'area' ? 3 : 2)) return null;
    const shape: Shape = {
      id: newId(),
      name: name?.trim() || `${kind === 'area' ? 'Area' : 'Line'} ${shapes.filter((s) => s.kind === kind).length + 1}`,
      kind,
      points: draft,
      notes: '',
      createdAt: now(),
    };
    await db.put('shapes', shape);
    set({ shapes: [shape, ...shapes], draft: [], mode: 'none' });
    return shape;
  },

  async removeShape(id) {
    await db.remove('shapes', id);
    set({ shapes: get().shapes.filter((s) => s.id !== id) });
  },

  async renameShape(id, name) {
    const s = get().shapes.find((x) => x.id === id);
    if (!s || !name.trim()) return;
    const next = { ...s, name: name.trim() };
    await db.put('shapes', next);
    set({ shapes: get().shapes.map((x) => (x.id === id ? next : x)) });
  },

  startTrack() {
    if (get().recording) return;
    set({ recording: { startedAt: Date.now(), points: [], distance: 0 } });
  },

  addFix({ lngLat, accuracy, altitude, time }) {
    const rec = get().recording;
    if (!rec || accuracy > TRACK_MAX_ACCURACY_M) return;
    const last = rec.points[rec.points.length - 1];
    const step = last ? distance(last.lngLat, lngLat) : 0;
    if (last && step < TRACK_MIN_STEP_M) return;
    set({ recording: { ...rec, points: [...rec.points, { lngLat, time, altitude }], distance: rec.distance + step } });
  },

  async stopTrack() {
    const rec = get().recording;
    set({ recording: null });
    if (!rec || rec.points.length < 2) return null;
    const started = new Date(rec.startedAt);
    const track: Track = {
      id: newId(),
      name: `Track ${started.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, ${started.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`,
      points: rec.points,
      startedAt: rec.startedAt,
      endedAt: Date.now(),
      distance: pathLength(rec.points.map((p) => p.lngLat)),
    };
    await db.put('tracks', track);
    set({ tracks: [track, ...get().tracks] });
    return track;
  },

  async removeTrack(id) {
    await db.remove('tracks', id);
    set({ tracks: get().tracks.filter((t) => t.id !== id) });
  },

  async renameTrack(id, name) {
    const t = get().tracks.find((x) => x.id === id);
    if (!t || !name.trim()) return;
    const next = { ...t, name: name.trim() };
    await db.put('tracks', next);
    set({ tracks: get().tracks.map((x) => (x.id === id ? next : x)) });
  },
}));

/** True while a tool owns map taps, so tap-to-read (Esau) should stay quiet. */
export function isToolCapturingTaps(): boolean {
  return useTools.getState().mode !== 'none';
}
