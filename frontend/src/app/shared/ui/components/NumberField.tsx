// NumberField.tsx
"use client";
import * as React from "react";
import { cx } from "@/app/shared/ui/utils/inputs";
import {
  FIELD_EDITABLE_BASE,
  FIELD_READONLY_BASE,
  FIELD_EDITABLE_STYLE,
  FIELD_READONLY_STYLE,
  FIELD_ERROR,
  FIELD_ERROR_STYLE,
  FIELD_LABEL,
  FIELD_HINT,
  FIELD_ERROR_TEXT,
  FORM_TEXT_VARS,
} from "@/app/shared/ui/tokens";

type Props = {
  label?: string;
  hint?: string;
  error?: string;
  containerClassName?: string;
  className?: string;
  variant?: "readonly" | "editable";
  disabled?: boolean;
  placeholder?: string;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  value: number | "" | null;
  onChange: (val: number | "") => void;
};

export default function NumberField({
  label,
  hint,
  error,
  containerClassName,
  className,
  variant = "editable",
  disabled,
  placeholder,
  unit,
  min,
  max,
  step,
  value,
  onChange,
}: Props) {
  const editable = variant === "editable";
  const effectiveDisabled = disabled || !editable;

  const baseClass = editable ? FIELD_EDITABLE_BASE : FIELD_READONLY_BASE;

  const style = {
    ...(editable ? FIELD_EDITABLE_STYLE : FIELD_READONLY_STYLE),
    ...(error ? FIELD_ERROR_STYLE : null),
    ...FORM_TEXT_VARS,
  } as React.CSSProperties;

  const displayValue = value === null || value === "" ? "" : String(value);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;

    // Povolíme prázdny string (user maže hodnotu) a čiastočný zápis desatinného čísla ("12.")
    if (raw === "") {
      onChange("");
      return;
    }

    // Nahradíme čiarku za bodku (SK klávesnica dáva čiarku)
    const normalized = raw.replace(",", ".");

    if (!/^\d*\.?\d*$/.test(normalized)) return;

    const num = Number(normalized);
    if (Number.isNaN(num)) return;

    onChange(num);
  }

  function handleBlur() {
    if (value === "" || value === null) return;
    let num = Number(value);
    if (min != null && num < min) num = min;
    if (max != null && num > max) num = max;
    onChange(num);
  }

  return (
    <div className={cx("space-y-1", containerClassName)} style={style}>
      {label ? <label className={FIELD_LABEL}>{label}</label> : null}

      <div className="relative">
        <input
          type="text"
          inputMode="decimal"
          pattern="[0-9]*"
          value={displayValue}
          placeholder={placeholder}
          disabled={effectiveDisabled}
          onChange={handleChange}
          onBlur={handleBlur}
          className={cx(baseClass, error && FIELD_ERROR, unit && "pr-12", className)}
        />
        {unit && (
          <span
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium opacity-50 pointer-events-none"
          >
            {unit}
          </span>
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
