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

/** Continuous high-accuracy GPS. Remembers the last fix so the map opens where you were. */
export function useGeolocation() {
  const [fix, setFix] = useState<Fix | null>(null);
  const [status, setStatus] = useState<GeoStatus>('waiting');

  useEffect(() => {
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
  }, []);

  return { fix, status };
}
