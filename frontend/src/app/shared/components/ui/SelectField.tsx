// src/app/shared/components/ui/SelectField.tsx
"use client";

import * as React from "react";
import { cx } from "@/app/shared/ui";
import {
  FIELD_BASE,
  FIELD_ERROR,
  FIELD_ERROR_TEXT,
  FIELD_HINT,
  FIELD_LABEL,
  SELECT_BTN,
  SELECT_ICON,
  SELECT_MENU,
  SELECT_MENU_WRAP,
  SELECT_OPT,
  SELECT_OPT_ACTIVE,
  SELECT_OPT_EMPTY,
} from "@/app/shared/ui/tokens";

type Option = { value: string; label: string };

type LegacyChangeEvent = {
  target: { value: string };
  currentTarget: { value: string };
  preventDefault: () => void;
  stopPropagation: () => void;
};

type Props = {
  label?: string;
  hint?: string;
  error?: string;
  disabled?: boolean;

  /** New style (current): controlled value */
  value: string | null;

  /**
   * New style handler (current): gets value directly.
   * (kept as main API to avoid breaking your newer screens)
   */
  onChange: (value: string | null) => void;

  /**
   * Optional alias for clarity (modern usage).
   * If provided, both onChange + onValueChange will be called.
   */
  onValueChange?: (value: string | null) => void;

  /**
   * Legacy compatibility:
   * Some old code expects onChange(e) and reads e.target.value.
   * We'll call this with a small synthetic event.
   */
  onLegacyChange?: (e: LegacyChangeEvent) => void;

  options: Option[];
  placeholder?: string; // keď value je null
  containerClassName?: string;
};

export default function SelectField({
  label,
  hint,
  error,
  disabled,
  value,
  onChange,
  onValueChange,
  onLegacyChange,
  options,
  placeholder = "—",
  containerClassName,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement | null>(null);

  const selected = options.find((o) => o.value === (value ?? "")) ?? null;
  const display = selected?.label ?? placeholder;

  React.useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function commit(next: string | null) {
    onChange(next);
    onValueChange?.(next);

    if (onLegacyChange) {
      const v = next ?? "";
      const evt: LegacyChangeEvent = {
        target: { value: v },
        currentTarget: { value: v },
        preventDefault: () => {},
        stopPropagation: () => {},
      };
      onLegacyChange(evt);
    }
  }

  return (
    <div className={cx("space-y-1", containerClassName)} ref={ref}>
      {label ? <label className={FIELD_LABEL}>{label}</label> : null}

      <div className={SELECT_MENU_WRAP}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
          className={cx(
            FIELD_BASE,
            SELECT_BTN,
            !selected && SELECT_OPT_EMPTY,
            error && FIELD_ERROR
          )}
          aria-expanded={open}
        >
          <span className="truncate">{display}</span>
          <svg viewBox="0 0 16 16" aria-hidden="true" className={SELECT_ICON}>
            <path
              d="M3 6.25L8 11l5-4.75"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {open && !disabled && (
          <div className={SELECT_MENU} role="listbox">
            {options.map((o) => {
              const active = (value ?? "") === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  className={cx(SELECT_OPT, active && SELECT_OPT_ACTIVE)}
                  onClick={() => {
                    setOpen(false);
                    commit(o.value ? o.value : null);
                  }}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {error ? (
        <div className={FIELD_ERROR_TEXT}>{error}</div>
      ) : hint ? (
        <div className={FIELD_HINT}>{hint}</div>
      ) : null}
    </div>
  );
}