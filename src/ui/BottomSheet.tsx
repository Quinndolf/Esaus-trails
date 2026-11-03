import { useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, CloseIcon } from './icons';

interface Props {
  title: string;
  open: boolean;
  onClose: () => void;
  /** Shows a back arrow, for sheets with drill-down pages. */
  onBack?: () => void;
  /** Compact height (about half the screen) so the thing the sheet is about stays visible on the map above it. */
  peek?: boolean;
  children: ReactNode;
}

/** onX-style sheet: fills most of the bottom of a phone, drag the handle down to dismiss. */
export function BottomSheet({ title, open, onClose, onBack, peek, children }: Props) {
  const startY = useRef<number | null>(null);
  const [drag, setDrag] = useState(0);
  const [tall, setTall] = useState(false);

  if (!open) return null;

  return (
    <>
      <div className={`sheet-scrim${peek ? ' scrim-clear' : ''}`} onClick={onClose} />
      <section
        className={`sheet${peek ? ' sheet-peek' : ''}${peek && tall ? ' is-tall' : ''}`}
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
            else if (peek && drag < 6) setTall((t) => !t); // a tap on the bar swaps small and tall
            startY.current = null;
            setDrag(0);
          }}
        >
          <div className="sheet-handle" title={peek ? 'Tap to make bigger or smaller' : undefined} />
          {onBack && (
            <button className="icon-btn back-btn" aria-label="Back" onClick={onBack} onPointerDown={(e) => e.stopPropagation()}>
              <ChevronLeft />
            </button>
          )}
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
