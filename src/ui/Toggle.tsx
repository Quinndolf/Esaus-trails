interface Props {
  on: boolean;
  onChange: (on: boolean) => void;
  label: string;
  disabled?: boolean;
}

/** onX-style green switch. */
export function Toggle({ on, onChange, label, disabled }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      className={`toggle ${on ? 'is-on' : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!on);
      }}
    >
      <span className="toggle-knob" />
    </button>
  );
}
