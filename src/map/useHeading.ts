import { useCallback, useEffect, useRef, useState } from 'react';
import { angleDelta, normalizeBearing } from './geo';

type IOSOrientationEvent = DeviceOrientationEvent & { webkitCompassHeading?: number };
type PermissionCapable = { requestPermission?: () => Promise<'granted' | 'denied'> };

export type HeadingStatus = 'idle' | 'active' | 'denied' | 'unsupported';

function screenAngle(): number {
  return (screen.orientation && screen.orientation.angle) || 0;
}

/**
 * Compass heading from the phone's magnetometer, smoothed.
 * iOS needs a user gesture to grant motion access, so call `start()` from a tap.
 */
export function useHeading(enabled: boolean) {
  const [heading, setHeading] = useState<number | null>(null);
  const [status, setStatus] = useState<HeadingStatus>('idle');
  const smooth = useRef<number | null>(null);

  const onEvent = useCallback((e: Event) => {
    const ev = e as IOSOrientationEvent;
    let raw: number | null = null;
    if (typeof ev.webkitCompassHeading === 'number') raw = ev.webkitCompassHeading;
    else if (ev.absolute && typeof ev.alpha === 'number') raw = 360 - ev.alpha;
    if (raw == null) return;
    raw = normalizeBearing(raw + screenAngle());
    const prev = smooth.current;
    const next = prev == null ? raw : normalizeBearing(prev + angleDelta(prev, raw) * 0.25);
    smooth.current = next;
    setHeading(next);
    setStatus('active');
  }, []);

  const start = useCallback(async () => {
    const DOE = (window as unknown as { DeviceOrientationEvent?: PermissionCapable }).DeviceOrientationEvent;
    if (!DOE) {
      setStatus('unsupported');
      return false;
    }
    if (typeof DOE.requestPermission === 'function') {
      try {
        if ((await DOE.requestPermission()) !== 'granted') {
          setStatus('denied');
          return false;
        }
      } catch {
        setStatus('denied');
        return false;
      }
    }
    return true;
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const hasAbsolute = 'ondeviceorientationabsolute' in window;
    const name = hasAbsolute ? 'deviceorientationabsolute' : 'deviceorientation';
    window.addEventListener(name, onEvent);
    return () => window.removeEventListener(name, onEvent);
  }, [enabled, onEvent]);

  return { heading, status, start };
}
