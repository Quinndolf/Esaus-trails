import { useRef, useState, type ReactNode } from 'react';
import { CloseIcon } from './icons';

interface Props {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

/** onX-style sheet: fills most of the bottom of a phone, drag the handle down to dismiss. */
export function BottomSheet({ title, open, onClose, children }: Props) {
  const startY = useRef<number | null>(null);
  const [drag, setDrag] = useState(0);

  if (!open) return null;

  return (
    <>
      <div className="sheet-scrim" onClick={onClose} />
      <section
        className="sheet"
        role="dialog"
        aria-label={title}
        style={drag ? { transform: `translateY(${drag}px)`, transition: 'none' } : undefined}
      >
        <header
          className="sheet-head"
          onPointerDown={(e) => {
            startY.current = e.clientY;
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          }}
          onPointerMove={(e) => startY.current != null && setDrag(Math.max(0, e.clientY - startY.current))}
          onPointerUp={() => {
            if (drag > 120) onClose();
            startY.current = null;
            setDrag(0);
          }}
        >
          <div className="sheet-handle" />
          <h2>{title}</h2>
          <button className="icon-btn" aria-label="Close" onClick={onClose} onPointerDown={(e) => e.stopPropagation()}>
            <CloseIcon />
          </button>
        </header>
        <div className="sheet-body">{children}</div>
      </section>
    </>
  );
}
