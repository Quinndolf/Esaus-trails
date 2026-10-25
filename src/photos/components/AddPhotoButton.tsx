import { useState } from 'react';
import { usePhotoPicker } from './usePhotoPicker';

/** Floating camera button with a small take/choose menu. */
export function AddPhotoButton({ className = 'fab' }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const picker = usePhotoPicker(() => setOpen(false));

  return (
    <div className="photo-add">
      {open && (
        <div className="photo-add__menu" role="menu">
          <button type="button" role="menuitem" onClick={picker.takePhoto}>
            Take photo
          </button>
          <button type="button" role="menuitem" onClick={picker.chooseFromRoll}>
            Choose from camera roll
          </button>
        </div>
      )}
      <button
        type="button"
        className={className}
        aria-label="Add photo"
        aria-expanded={open}
        disabled={picker.busy}
        onClick={() => setOpen((o) => !o)}
      >
        {picker.busy ? '…' : <CameraIcon />}
      </button>
      {picker.inputs}
    </div>
  );
}

export function CameraIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13.5" r="3.5" />
    </svg>
  );
}
