import type { LngLat } from '../map/geo';

export const WAYPOINT_ICONS = ['x', 'stand', 'blind', 'bed', 'food', 'water', 'rub', 'scrape', 'trail', 'camera', 'truck', 'flag'] as const;
export type WaypointIcon = (typeof WAYPOINT_ICONS)[number];

export interface Waypoint {
  id: string;
  name: string;
  icon: WaypointIcon;
  notes: string;
  position: LngLat;
  /** Meters, from GPS when marked where the hunter stood. */
  altitude: number | null;
  /** Ids of images in the shared on-device photo store. */
  photoIds: string[];
  createdAt: string;
  updatedAt: string;
}

export type ShapeKind = 'line' | 'area';

export interface Shape {
  id: string;
  name: string;
  kind: ShapeKind;
  points: LngLat[];
  notes: string;
  createdAt: string;
}

export interface TrackPoint {
  lngLat: LngLat;
  time: number;
  altitude: number | null;
}

export interface Track {
  id: string;
  name: string;
  points: TrackPoint[];
  startedAt: number;
  endedAt: number;
  /** Meters. */
  distance: number;
}

/** What a map tap does right now. */
export type ToolMode = 'none' | 'measure' | 'draw-line' | 'draw-area' | 'drop-waypoint';
