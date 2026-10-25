/**
 * Makes a small JPEG for the pin marker and the list. Respects EXIF
 * orientation. Returns null where the browser can't decode the image
 * (HEIC on Chrome, or tests), in which case the full image is used.
 */
export async function makeThumbnail(blob: Blob, maxSize = 256): Promise<Blob | null> {
  if (typeof createImageBitmap !== 'function') return null;
  try {
    const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);

    if (typeof OffscreenCanvas !== 'undefined') {
      const canvas = new OffscreenCanvas(w, h);
      canvas.getContext('2d')?.drawImage(bitmap, 0, 0, w, h);
      bitmap.close();
      return await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.8 });
    }
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    return await new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.8));
  } catch {
    return null;
  }
}
