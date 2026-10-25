import exifr from 'exifr';
import type { LngLat, PhotoMeta } from './types';

const EMPTY: PhotoMeta = {
  position: null,
  altitude: null,
  takenAt: null,
  heading: null,
  width: null,
  height: null,
};

/**
 * Reads GPS position, altitude, capture time and heading from a photo.
 * Never throws: a photo with no readable EXIF comes back with null fields,
 * which is the signal to ask the hunter to drop the pin by hand.
 */
export async function readPhotoMeta(file: Blob): Promise<PhotoMeta> {
  let raw: Record<string, unknown> | undefined;
  try {
    raw = await exifr.parse(file, {
      tiff: true,
      exif: true,
      gps: true,
      ifd1: false,
      xmp: false,
      icc: false,
      iptc: false,
      // exifr fills latitude/longitude as signed decimals when GPS is present.
      reviveValues: true,
      translateValues: true,
    });
  } catch {
    return { ...EMPTY };
  }
  if (!raw) return { ...EMPTY };

  return {
    position: toPosition(raw.latitude, raw.longitude),
    altitude: toAltitude(raw.GPSAltitude, raw.GPSAltitudeRef),
    takenAt: toIso(raw.DateTimeOriginal ?? raw.CreateDate ?? raw.ModifyDate, raw.OffsetTimeOriginal),
    heading: toNumber(raw.GPSImgDirection),
    width: toNumber(raw.ExifImageWidth ?? raw.ImageWidth),
    height: toNumber(raw.ExifImageHeight ?? raw.ImageHeight),
  };
}

export function toPosition(lat: unknown, lng: unknown): LngLat | null {
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  // Some phones write 0,0 when they had no fix. Nobody is hunting off the coast of Ghana.
  if (lat === 0 && lng === 0) return null;
  return { lat, lng };
}

function toAltitude(alt: unknown, ref: unknown): number | null {
  const value = toNumber(alt);
  if (value === null) return null;
  // Ref 1 means below sea level. Depending on the file, exifr hands it back as
  // a number, a one-byte array, or translated text.
  const flag = ref instanceof Uint8Array || Array.isArray(ref) ? ref[0] : ref;
  const below = flag === 1 || (typeof flag === 'string' && /below/i.test(flag));
  return below ? -value : value;
}

export function toIso(value: unknown, offset: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    // exifr builds the Date in the browser's timezone because EXIF stores local
    // camera time. If the camera wrote its UTC offset, correct for it.
    if (typeof offset === 'string' && /^[+-]\d{2}:\d{2}$/.test(offset)) {
      const sign = offset.startsWith('-') ? -1 : 1;
      const [h, m] = offset.slice(1).split(':').map(Number);
      const cameraOffsetMin = sign * (h * 60 + m);
      const browserOffsetMin = -value.getTimezoneOffset();
      return new Date(value.getTime() - (cameraOffsetMin - browserOffsetMin) * 60_000).toISOString();
    }
    return value.toISOString();
  }
  if (typeof value === 'string') {
    // "2024:11:08 06:42:10" is the raw EXIF shape.
    const m = value.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
    if (m) return new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`).toISOString();
  }
  return null;
}

function toNumber(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}
