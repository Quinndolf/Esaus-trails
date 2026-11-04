import { useEffect, useState } from 'react';
import type { LngLat } from './geo';

export interface Fix {
  lngLat: LngLat;
  accuracy: number; // meters
  altitude: number | null; // meters
  heading: number | null; // degrees, only while moving
  speed: number | null; // m/s
  time: number;
}

export type GeoStatus = 'waiting' | 'tracking' | 'denied' | 'unavailable';

const LAST_KEY = 'esau-last-fix';

export function lastKnownFix(): Fix | null {
  try {
    const raw = localStorage.getItem(LAST_KEY);
    return raw ? (JSON.parse(raw) as Fix) : null;
  } catch {
    return null;
  }
}

/**
 * GPS only runs when it is needed (battery): while the map follows you, the compass is on, or a track is
 * recording. Panning away, or the app going to the background, switches it off; a tracked hunt keeps it on.
 */
export function gpsWanted(s: { mode: 'follow' | 'free' | 'compass'; recording: boolean; visible: boolean }): boolean {
  return s.recording || (s.visible && s.mode !== 'free');
}

/** High-accuracy GPS while `active`. Remembers the last fix so the map opens where you were. */
export function useGeolocation(active = true) {
  const [fix, setFix] = useState<Fix | null>(null);
  const [status, setStatus] = useState<GeoStatus>('waiting');

  useEffect(() => {
    if (!active) return;
    if (!('geolocation' in navigator)) {
      setStatus('unavailable');
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const next: Fix = {
          lngLat: [p.coords.longitude, p.coords.latitude],
          accuracy: p.coords.accuracy,
          altitude: p.coords.altitude,
          heading: p.coords.heading != null && !Number.isNaN(p.coords.heading) ? p.coords.heading : null,
          speed: p.coords.speed,
          time: p.timestamp,
        };
        setFix(next);
        setStatus('tracking');
        try {
          localStorage.setItem(LAST_KEY, JSON.stringify(next));
        } catch {
          /* ignore */
        }
      },
      (err) => setStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable'),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [active]);

  return { fix, status };
}

/** One fresh reading for a single action (marking a spot) while the continuous watch is off. Null if none in time. */
export function currentFix(timeoutMs = 10000): Promise<Fix | null> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) =>
        resolve({
          lngLat: [p.coords.longitude, p.coords.latitude],
          accuracy: p.coords.accuracy,
          altitude: p.coords.altitude,
          heading: null,
          speed: p.coords.speed,
          time: p.timestamp,
        }),
      () => resolve(null),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: timeoutMs },
    );
  });
}

export const GOOD_ACCURACY_M = 25;

/**
 * For marking a spot: listen for up to `timeoutMs` and keep the most accurate reading, stopping early once one is
 * within `goodM`. The first reading a phone gives is often a coarse cell-tower or Wi-Fi guess hundreds of
 * meters off; the real GPS lock follows seconds later. Null if nothing arrived.
 */
export function bestFix(timeoutMs = 12000, goodM = GOOD_ACCURACY_M): Promise<Fix | null> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) return resolve(null);
    let best: Fix | null = null;
    let done = false;
    let id = -1;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (id >= 0) navigator.geolocation.clearWatch(id);
      resolve(best);
    };
    const timer = setTimeout(finish, timeoutMs);
    id = navigator.geolocation.watchPosition(
      (p) => {
        const f: Fix = {
          lngLat: [p.coords.longitude, p.coords.latitude],
          accuracy: p.coords.accuracy,
          altitude: p.coords.altitude,
          heading: null,
          speed: p.coords.speed,
          time: p.timestamp,
        };
        if (!best || f.accuracy < best.accuracy) best = f;
        if (best.accuracy <= goodM) finish();
      },
      () => finish(),
      { enableHighAccuracy: true, maximumAge: 0, timeout: timeoutMs },
    );
    if (done) navigator.geolocation.clearWatch(id);
  });
}
