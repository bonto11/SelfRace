"use client";
import * as React from "react";
import { useMemo } from "react";
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

type Props = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "children"> & {
  label?: string;
  hint?: string;
  error?: string;
  containerClassName?: string;
  variant?: "readonly" | "editable";
  min: number;
  max: number;
  step?: number;
  suffix?: string; // napr. "bpm" alebo "W"
};

export default function NumberWheelField({
  label,
  hint,
  error,
  containerClassName,
  className,
  variant = "editable",
  disabled,
  min,
  max,
  step = 1,
  suffix = "",
  ...rest
}: Props) {
  const editable = variant === "editable";
  const effectiveDisabled = disabled || !editable;

  const baseClass = editable ? FIELD_EDITABLE_BASE : FIELD_READONLY_BASE;

  const style = {
    ...(editable ? FIELD_EDITABLE_STYLE : FIELD_READONLY_STYLE),
    ...(error ? FIELD_ERROR_STYLE : null),
    ...FORM_TEXT_VARS,
  } as React.CSSProperties;

  // Vygenerujeme pole čísel (napr. od 100 do 200)
  const options = useMemo(() => {
    const opts = [];
    for (let i = min; i <= max; i += step) {
      opts.push(i);
    }
    return opts;
  }, [min, max, step]);

  return (
    <div className={cx("space-y-1", containerClassName)} style={style}>
      {label ? <label className={FIELD_LABEL}>{label}</label> : null}

      {/* Používame natívny select, ktorý na mobile spustí "točiaci bubon" */}
      <select
        {...rest}
        disabled={effectiveDisabled}
        className={cx(baseClass, error && FIELD_ERROR, className, "appearance-none bg-transparent")}
      >
        <option value="" disabled hidden>
          Vyberte hodnotu...
        </option>
        {options.map((val) => (
          <option key={val} value={val}>
            {val} {suffix}
          </option>
        ))}
      </select>

      {error ? (
        <div className={FIELD_ERROR_TEXT}>{error}</div>
      ) : hint ? (
        <div className={FIELD_HINT}>{hint}</div>
      ) : null}
    </div>
  );
}