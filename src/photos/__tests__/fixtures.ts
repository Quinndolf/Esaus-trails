import piexif from 'piexifjs';

/** An 8x8 green JPEG with no metadata. */
const PLAIN_JPEG_B64 =
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAIAAgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDHoooryTmP/9k=';

export interface FixtureExif {
  lat?: number;
  lng?: number;
  altitude?: number;
  belowSeaLevel?: boolean;
  takenAt?: string; // "YYYY:MM:DD HH:MM:SS"
  heading?: number;
}

export function jpegFile(exif: FixtureExif | null, name = 'photo.jpg'): File {
  let binary = atob(PLAIN_JPEG_B64);
  if (exif) {
    const gps: Record<number, unknown> = {};
    const ex: Record<number, unknown> = {};
    if (exif.lat !== undefined && exif.lng !== undefined) {
      gps[piexif.GPSIFD.GPSLatitudeRef] = exif.lat < 0 ? 'S' : 'N';
      gps[piexif.GPSIFD.GPSLatitude] = piexif.GPSHelper.degToDmsRational(Math.abs(exif.lat));
      gps[piexif.GPSIFD.GPSLongitudeRef] = exif.lng < 0 ? 'W' : 'E';
      gps[piexif.GPSIFD.GPSLongitude] = piexif.GPSHelper.degToDmsRational(Math.abs(exif.lng));
    }
    if (exif.altitude !== undefined) {
      gps[piexif.GPSIFD.GPSAltitude] = [Math.round(exif.altitude * 100), 100];
      gps[piexif.GPSIFD.GPSAltitudeRef] = exif.belowSeaLevel ? 1 : 0;
    }
    if (exif.heading !== undefined) gps[piexif.GPSIFD.GPSImgDirection] = [Math.round(exif.heading * 100), 100];
    if (exif.takenAt) ex[piexif.ExifIFD.DateTimeOriginal] = exif.takenAt;
    binary = piexif.insert(piexif.dump({ '0th': {}, Exif: ex, GPS: gps }), binary);
  }
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new File([bytes], name, { type: 'image/jpeg' });
}
