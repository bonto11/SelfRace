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
  showReset?: boolean;
};

function decimalsFromStep(step?: number): number {
  if (!step || step >= 1) return 0;
  const s = String(step);
  const idx = s.indexOf(".");
  return idx === -1 ? 0 : s.length - idx - 1;
}

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
  showReset = true,
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
  const decimals = decimalsFromStep(step);
  const hasValue = value !== null && value !== "";

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;

    if (raw === "") {
      onChange("");
      return;
    }

    const normalized = raw.replace(",", ".");

    if (!/^\d*\.?\d*$/.test(normalized)) return;

    const dotIdx = normalized.indexOf(".");
    if (dotIdx !== -1 && decimals >= 0) {
      const decimalsPart = normalized.slice(dotIdx + 1);
      if (decimalsPart.length > decimals) return;
    }

    if (normalized.endsWith(".")) {
      onChange(normalized as unknown as number);
      return;
    }

    const num = Number(normalized);
    if (Number.isNaN(num)) return;

    onChange(num);
  }

  function handleBlur() {
    if (value === "" || value === null) return;
    let num = Number(value);
    if (Number.isNaN(num)) {
      onChange("");
      return;
    }

    const factor = Math.pow(10, decimals);
    num = Math.round(num * factor) / factor;

    if (min != null && num < min) num = min;
    if (max != null && num > max) num = max;
    onChange(num);
  }

  function handleReset() {
    onChange("");
  }

  return (
    <div className={cx("space-y-1", containerClassName)} style={style}>
      {label ? <label className={FIELD_LABEL}>{label}</label> : null}

      <div className="relative">
        <input
          type="text"
          inputMode="decimal"
          value={displayValue}
          placeholder={placeholder}
          disabled={effectiveDisabled}
          onChange={handleChange}
          onBlur={handleBlur}
          className={cx(
            baseClass,
            error && FIELD_ERROR,
            unit && (showReset && hasValue ? "pr-20" : "pr-12"),
            className
          )}
        />

        {showReset && hasValue && !effectiveDisabled && (
          <button
            type="button"
            onClick={handleReset}
            aria-label="Reset"
            className="absolute right-9 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center text-[11px] leading-none opacity-50 hover:opacity-90 transition-opacity"
            style={{ color: "#111111", border: "1px solid currentColor" }}
          >
            ✕
          </button>
        )}

        {unit && (
          <span
            className="absolute right-3 top-1/2 -translate-y-1/2 text-sm pointer-events-none"
            style={{ color: "#111111" }}
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
