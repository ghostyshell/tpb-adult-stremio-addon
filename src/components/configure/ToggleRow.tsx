'use client';

interface ToggleRowProps {
  id: string;
  name?: string;
  label: string;
  desc?: string;
  checked?: boolean;
  disabled?: boolean;
  badge?: string;
  maintenance?: boolean;
  down?: boolean;
  onChange?: (checked: boolean) => void;
}

export function ToggleRow({
  id,
  name,
  label,
  desc,
  checked = false,
  disabled = false,
  badge,
  maintenance,
  down,
  onChange,
}: ToggleRowProps) {
  return (
    <div className="sw-row">
      <div className="sw-row-body">
        <div className="sw-row-text">
          <div className="sw-row-title">
            {label}
            {badge ? <span className="src-badge">{badge}</span> : null}
            {maintenance ? <span className="src-badge src-maint">WIP</span> : null}
            {down ? <span className="src-badge src-down">Down</span> : null}
          </div>
          {desc ? <div className="sw-row-desc">{desc}</div> : null}
        </div>
      </div>
      <label className="sw-wrap" htmlFor={id} aria-label={label}>
        <input
          type="checkbox"
          id={id}
          name={name}
          value="1"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange?.(e.target.checked)}
        />
        <span className="sw-track" />
      </label>
    </div>
  );
}
