import { BottomSheet } from '../../ui/BottomSheet';
import type { PhotoPin } from '../types';
import { CameraIcon } from './AddPhotoButton';
import { PhotoList } from './PhotoList';
import { usePhotoPicker } from './usePhotoPicker';

interface Props {
  open: boolean;
  onClose(): void;
  /** A pin was picked from the list; the map should fly to it. */
  onPick?(pin: PhotoPin): void;
}

/** "Photos" sheet from the Tools menu: add a photo, browse and filter the ones you have. */
export function PhotosSheet({ open, onClose, onPick }: Props) {
  // Close as soon as files are chosen so the map is visible for a manual drop.
  const picker = usePhotoPicker(onClose);

  return (
    <>
      {picker.inputs}
      <BottomSheet title="Photos" open={open} onClose={onClose}>
        <div className="photo-sheet__actions">
          <button type="button" onClick={picker.takePhoto} disabled={picker.busy}>
            <CameraIcon /> Take photo
          </button>
          <button type="button" onClick={picker.chooseFromRoll} disabled={picker.busy}>
            Camera roll
          </button>
        </div>
        <PhotoList
          onPick={(pin) => {
            onClose();
            onPick?.(pin);
          }}
        />
      </BottomSheet>
    </>
  );
}
