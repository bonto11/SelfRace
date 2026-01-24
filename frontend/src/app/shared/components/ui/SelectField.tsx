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

/**
 * Legacy event-like shape (enough for your current code):
 * - e.target.value
 * - e.currentTarget.value
 */
type SelectChangeEvent = {
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

  /** LEGACY-compatible controlled value (matches PersonalSettingsPanel usage) */
  value: string;

  /**
   * LEGACY-compatible onChange.
   * PersonalSettingsPanel expects (e) => e.target.value
   */
  onChange: (e: SelectChangeEvent) => void;

  /**
   * Optional helper for newer code (value-based).
   * (Not used by PersonalSettings; safe to ignore.)
   */
  onValueChange?: (value: string) => void;

  options: Option[];
  placeholder?: string; // keď value je prázdny string
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
  options,
  placeholder = "—",
  containerClassName,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement | null>(null);

  const selected = options.find((o) => o.value === value) ?? null;
  const display = selected?.label ?? (value ? value : placeholder);

  React.useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function emit(next: string) {
    const evt: SelectChangeEvent = {
      target: { value: next },
      currentTarget: { value: next },
      preventDefault: () => {},
      stopPropagation: () => {},
    };
    onChange(evt);
    onValueChange?.(next);
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
            !selected && !value && SELECT_OPT_EMPTY,
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
              const active = value === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  className={cx(SELECT_OPT, active && SELECT_OPT_ACTIVE)}
                  onClick={() => {
                    setOpen(false);
                    emit(o.value);
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