// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { _resetDbForTests, getPhoto, listPins } from '../photoDb';
import { normalizeTags, usePhotoPins } from '../store';
import { setPhotoUploader } from '../upload';
import { jpegFile } from './fixtures';

const initial = usePhotoPins.getState();

beforeEach(async () => {
  await _resetDbForTests();
  localStorage.clear();
  setPhotoUploader(null);
  usePhotoPins.setState({ ...initial, pins: [], pending: null, selectedPinId: null, uploadEnabled: false });
});

describe('photo pin store', () => {
  it('places a pin from EXIF GPS and stores it on the device', async () => {
    const result = await usePhotoPins.getState().addPhoto(jpegFile({ lat: 37.8, lng: -85.7, altitude: 200 }));
    expect(result.kind).toBe('placed');
    if (result.kind !== 'placed') return;
    expect(result.pin.source).toBe('exif');
    expect(result.pin.position.lat).toBeCloseTo(37.8, 4);
    expect(result.pin.upload).toBe('local-only');
    expect(usePhotoPins.getState().selectedPinId).toBe(result.pin.id);

    expect(await listPins()).toHaveLength(1);
    expect(await getPhoto(result.pin.photoId)).toBeDefined();
  });

  it('asks for a manual drop when the photo has no GPS, then places it', async () => {
    const result = await usePhotoPins.getState().addPhoto(jpegFile(null, 'stripped.jpg'));
    expect(result.kind).toBe('needs-location');
    expect(usePhotoPins.getState().pending?.fileName).toBe('stripped.jpg');

    const pin = await usePhotoPins.getState().placePending({ lng: -85.1, lat: 37.1 });
    expect(pin?.source).toBe('manual');
    expect(pin?.position).toEqual({ lng: -85.1, lat: 37.1 });
    expect(usePhotoPins.getState().pending).toBeNull();
    expect(usePhotoPins.getState().pins).toHaveLength(1);
  });

  it('uses the device fix for a photo just taken in the app with no GPS', async () => {
    const result = await usePhotoPins
      .getState()
      .addPhoto(jpegFile(null), { capturedNow: true, devicePosition: { lng: -85.2, lat: 37.2 }, deviceAltitude: 180 });
    expect(result.kind).toBe('placed');
    if (result.kind !== 'placed') return;
    expect(result.pin.source).toBe('device-gps');
    expect(result.pin.altitude).toBe(180);
  });

  it('prefers EXIF GPS over the device fix', async () => {
    const result = await usePhotoPins
      .getState()
      .addPhoto(jpegFile({ lat: 37.8, lng: -85.7 }), { capturedNow: true, devicePosition: { lng: 0.5, lat: 0.5 } });
    expect(result.kind === 'placed' && result.pin.source).toBe('exif');
  });

  it('deletes the stored photo when a manual drop is cancelled', async () => {
    const result = await usePhotoPins.getState().addPhoto(jpegFile(null));
    if (result.kind !== 'needs-location') throw new Error('expected pending');
    await usePhotoPins.getState().cancelPending();
    expect(await getPhoto(result.pending.photoId)).toBeUndefined();
    expect(usePhotoPins.getState().pins).toHaveLength(0);
  });

  it('saves names, notes and tags, and survives a reload', async () => {
    const result = await usePhotoPins.getState().addPhoto(jpegFile({ lat: 37.8, lng: -85.7 }));
    if (result.kind !== 'placed') throw new Error('expected placed');
    await usePhotoPins.getState().updatePin(result.pin.id, {
      name: 'Rub line by the creek',
      notes: 'Fresh, waist high',
      tags: ['Rub', ' trail ', 'rub'],
    });

    usePhotoPins.setState({ pins: [] });
    await usePhotoPins.getState().load();
    const [pin] = usePhotoPins.getState().pins;
    expect(pin.name).toBe('Rub line by the creek');
    expect(pin.notes).toBe('Fresh, waist high');
    expect(pin.tags).toEqual(['rub', 'trail']);
  });

  it('marks a dragged pin as manually placed', async () => {
    const result = await usePhotoPins.getState().addPhoto(jpegFile({ lat: 37.8, lng: -85.7 }));
    if (result.kind !== 'placed') throw new Error('expected placed');
    await usePhotoPins.getState().updatePin(result.pin.id, { position: { lng: -85.71, lat: 37.81 } });
    expect(usePhotoPins.getState().pins[0].source).toBe('manual');
  });

  it('removes a pin and its photo together', async () => {
    const result = await usePhotoPins.getState().addPhoto(jpegFile({ lat: 37.8, lng: -85.7 }));
    if (result.kind !== 'placed') throw new Error('expected placed');
    await usePhotoPins.getState().removePin(result.pin.id);
    expect(await listPins()).toHaveLength(0);
    expect(await getPhoto(result.pin.photoId)).toBeUndefined();
    expect(usePhotoPins.getState().selectedPinId).toBeNull();
  });

  it('keeps everything local until the hunter turns uploads on', async () => {
    const upload = vi.fn().mockResolvedValue(undefined);
    setPhotoUploader({ upload });
    await usePhotoPins.getState().addPhoto(jpegFile({ lat: 37.8, lng: -85.7 }));
    expect(upload).not.toHaveBeenCalled();

    await usePhotoPins.getState().setUploadEnabled(true);
    expect(upload).toHaveBeenCalledTimes(1);
    expect(usePhotoPins.getState().pins[0].upload).toBe('uploaded');
    expect(localStorage.getItem('esau.photos.uploadEnabled')).toBe('true');
  });

  it('marks a failed upload and retries it next time uploads are turned on', async () => {
    const upload = vi.fn().mockRejectedValueOnce(new Error('no service')).mockResolvedValue(undefined);
    setPhotoUploader({ upload });
    await usePhotoPins.getState().addPhoto(jpegFile({ lat: 37.8, lng: -85.7 }));
    await usePhotoPins.getState().setUploadEnabled(true);
    expect(usePhotoPins.getState().pins[0].upload).toBe('failed');

    await usePhotoPins.getState().setUploadEnabled(false);
    await usePhotoPins.getState().setUploadEnabled(true);
    expect(usePhotoPins.getState().pins[0].upload).toBe('uploaded');
  });

  it('queues pins while uploads are on but no uploader is set', async () => {
    await usePhotoPins.getState().setUploadEnabled(true);
    const result = await usePhotoPins.getState().addPhoto(jpegFile({ lat: 37.8, lng: -85.7 }));
    expect(result.kind === 'placed' && result.pin.upload).toBe('queued');
  });
});

describe('normalizeTags', () => {
  it('lowercases, trims and dedupes', () => {
    expect(normalizeTags(['Bedding', ' bedding', '', 'Scrape '])).toEqual(['bedding', 'scrape']);
  });
});
