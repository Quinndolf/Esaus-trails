interface ToggleProps {
  checked: boolean;
  onChange(checked: boolean): void;
  label: string;
}

/** The green switch used across the app's sheets. */
export function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="toggle"
      onClick={() => onChange(!checked)}
    >
      <span className="toggle__knob" />
    </button>
  );
}
