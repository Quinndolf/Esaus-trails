import { getPhoto } from './photoDb';
import type { LngLat, PhotoPin, PinSource } from './types';

/**
 * What the Esau module gets when the hunter asks him about a photo pin.
 * Esau's side adds topo, wind and thermals for `position` and `takenAt`;
 * this module only supplies the photo and what the hunter wrote about it.
 */
export interface EsauPhotoInput {
  pinId: string;
  name: string;
  notes: string;
  tags: string[];
  position: LngLat;
  altitude: number | null;
  takenAt: string | null;
  heading: number | null;
  /** 'manual' means the hunter placed it by hand, so the spot may be off by some distance. */
  locationSource: PinSource;
  image: { mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'; base64: string } | null;
}

/** Long edge cap that keeps vision requests small without losing detail. */
const VISION_MAX_EDGE = 1568;

export async function buildEsauPhotoInput(pin: PhotoPin): Promise<EsauPhotoInput> {
  const photo = await getPhoto(pin.photoId);
  return {
    pinId: pin.id,
    name: pin.name,
    notes: pin.notes,
    tags: pin.tags,
    position: pin.position,
    altitude: pin.altitude,
    takenAt: pin.takenAt,
    heading: pin.heading,
    locationSource: pin.source,
    image: photo ? await toVisionImage(photo.blob) : null,
  };
}

async function toVisionImage(blob: Blob): Promise<EsauPhotoInput['image']> {
  const resized = await resizeForVision(blob);
  const source = resized ?? blob;
  const mediaType = asSupportedType(source.type);
  // A HEIC we couldn't re-encode can't be sent; Esau will say he can't see it.
  if (!mediaType) return null;
  return { mediaType, base64: await blobToBase64(source) };
}

async function resizeForVision(blob: Blob): Promise<Blob | null> {
  if (typeof createImageBitmap !== 'function' || typeof OffscreenCanvas === 'undefined') return null;
  try {
    const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
    const scale = Math.min(1, VISION_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = new OffscreenCanvas(Math.round(bitmap.width * scale), Math.round(bitmap.height * scale));
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.85 });
  } catch {
    return null;
  }
}

function asSupportedType(type: string): NonNullable<EsauPhotoInput['image']>['mediaType'] | null {
  if (type === 'image/jpeg' || type === 'image/png' || type === 'image/webp' || type === 'image/gif') return type;
  if (type === 'image/jpg' || type === '') return 'image/jpeg';
  return null;
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}
