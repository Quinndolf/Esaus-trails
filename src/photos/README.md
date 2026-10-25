# src/photos

Photo pins: take a photo or pick one from the camera roll, read its EXIF, drop a pin where it was taken, and keep it on the phone.

## How a photo becomes a pin

1. `readPhotoMeta` (exifr) pulls latitude, longitude, altitude, capture time and camera heading. It never throws; missing fields come back `null`. A 0,0 fix is treated as no fix.
2. The image and a 256px thumbnail go into IndexedDB (`esau-photos` database). Nothing leaves the device unless the hunter turns on backup.
3. Placement, in order:
   - GPS in the EXIF: pin placed, `source: 'exif'`.
   - Photo just taken in the app with no GPS (browsers often strip it from camera captures): the device's current fix is used, `source: 'device-gps'`.
   - Otherwise the photo becomes `pending` and `ManualPinPrompt` asks the hunter to tap the map (or use their location), `source: 'manual'`.
4. Each pin carries a name (defaults to "Photo Nov 8, 6:42 AM"), notes, and tags. Presets are bedding, food, trail, rub, scrape and sign; custom tags are allowed and lowercased.

## Mounting it in the map shell

```tsx
import {
  AddPhotoButton, ManualPinPrompt, PhotoList, PhotoPinSheet,
  usePhotoPins, usePhotoPinMarkers, useManualPinDrop, isAwaitingPinDrop, flyToPin,
} from './photos';

usePhotoPins.getState().load();      // once at startup
usePhotoPinMarkers(map);             // thumbnail markers; tap selects a pin
useManualPinDrop(map);               // next map tap places a pending photo

<AddPhotoButton />                   // camera / camera roll
<ManualPinPrompt />                  // shows only while a photo needs a spot
<PhotoPinSheet onAskEsau={(input) => esau.analyzePhoto(input)} />
<PhotoList onPick={(pin) => flyToPin(map, pin)} />   // for the waypoint list
```

The map's "read this spot" tap handler should return early while `isAwaitingPinDrop()` is true, so a tap meant to place a photo doesn't also open a spot reading.

`PhotoPinSheet` and `PhotoList` render their own content; `PhotoPinSheet` uses the `.sheet` class for now and can move into `src/ui/BottomSheet` once that lands.

## Esau

`buildEsauPhotoInput(pin)` returns an `EsauPhotoInput`: the image as base64 JPEG (resized to 1568px on the long edge), position, altitude, time taken, heading, tags, notes, and `locationSource`. The Esau module adds topo, wind and thermals for that spot and time. A `manual` location may be off by some distance, and a `null` image means the format couldn't be read (HEIC on a non-Apple browser), so Esau should say so rather than guess.

## Optional upload

Off by default; the setting persists in `localStorage`. With it on, pins are queued and sent through the uploader set by `setPhotoUploader`. `httpUploader('/api/photos')` posts multipart `pin` + `photo` once the server has that route. Until an uploader is set, pins wait in `queued`. Failed uploads are retried the next time backup is turned on.

## Tests

`npm test` covers EXIF parsing (GPS, below-sea-level altitude, capture time with UTC offset, no EXIF, non-images) and the store (EXIF placement, manual fallback, device-fix fallback, cancel cleanup, edits surviving reload, delete, upload toggle and retry), against fake-indexeddb.
