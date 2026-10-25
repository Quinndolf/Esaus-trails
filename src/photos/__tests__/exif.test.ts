// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { readPhotoMeta, toIso, toPosition } from '../exif';
import { jpegFile } from './fixtures';

describe('readPhotoMeta', () => {
  it('reads GPS, altitude, heading and capture time', async () => {
    const meta = await readPhotoMeta(
      jpegFile({ lat: 37.84123, lng: -85.76456, altitude: 214.5, heading: 271.3, takenAt: '2025:11:08 06:42:10' }),
    );
    expect(meta.position?.lat).toBeCloseTo(37.84123, 4);
    expect(meta.position?.lng).toBeCloseTo(-85.76456, 4);
    expect(meta.altitude).toBeCloseTo(214.5, 1);
    expect(meta.heading).toBeCloseTo(271.3, 1);
    // No offset in the file, so it reads as local time.
    expect(meta.takenAt).toBe(new Date('2025-11-08T06:42:10').toISOString());
  });

  it('makes altitude negative below sea level', async () => {
    const meta = await readPhotoMeta(jpegFile({ lat: 36.2, lng: -116.8, altitude: 86, belowSeaLevel: true }));
    expect(meta.altitude).toBeCloseTo(-86, 1);
  });

  it('returns nulls for a photo with no EXIF', async () => {
    const meta = await readPhotoMeta(jpegFile(null));
    expect(meta.position).toBeNull();
    expect(meta.altitude).toBeNull();
    expect(meta.takenAt).toBeNull();
  });

  it('keeps the time when there is no GPS', async () => {
    const meta = await readPhotoMeta(jpegFile({ takenAt: '2025:11:08 06:42:10' }));
    expect(meta.position).toBeNull();
    expect(meta.takenAt).not.toBeNull();
  });

  it('does not throw on a file that is not an image', async () => {
    const meta = await readPhotoMeta(new File(['hello'], 'notes.txt', { type: 'text/plain' }));
    expect(meta.position).toBeNull();
  });
});

describe('toPosition', () => {
  it('rejects 0,0 and out of range values', () => {
    expect(toPosition(0, 0)).toBeNull();
    expect(toPosition(91, 10)).toBeNull();
    expect(toPosition(NaN, 10)).toBeNull();
    expect(toPosition(37, -85)).toEqual({ lat: 37, lng: -85 });
  });
});

describe('toIso', () => {
  it('corrects local camera time using the recorded UTC offset', () => {
    // exifr builds the Date as if the camera's clock were in this browser's zone.
    const local = new Date('2025-11-08T06:42:10');
    expect(toIso(local, '-05:00')).toBe('2025-11-08T11:42:10.000Z');
    expect(toIso(local, '+01:00')).toBe('2025-11-08T05:42:10.000Z');
  });

  it('parses the raw EXIF date string', () => {
    expect(toIso('2025:11:08 06:42:10', undefined)).toBe(new Date('2025-11-08T06:42:10').toISOString());
  });

  it('returns null for junk', () => {
    expect(toIso('yesterday', undefined)).toBeNull();
    expect(toIso(new Date(NaN), undefined)).toBeNull();
  });
});
