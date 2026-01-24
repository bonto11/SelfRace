// src/app/shared/components/ui/DateField.tsx
"use client";

import * as React from "react";
import { cx } from "@/app/shared/ui";
import {
  FIELD_BASE,
  FIELD_LABEL,
  FIELD_HINT,
  FIELD_ERROR,
  FIELD_ERROR_TEXT,
} from "@/app/shared/ui/tokens";

type Props = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "onChange"
> & {
  label?: string;
  hint?: string;
  error?: string;
  containerClassName?: string;
  value: string | null;
  onChange: (value: string | null) => void;
};

export default function DateField({
  label,
  hint,
  error,
  containerClassName,
  className,
  value,
  onChange,
  ...rest
}: Props) {
  return (
    <div className={cx("space-y-1", containerClassName)}>
      {label ? <label className={FIELD_LABEL}>{label}</label> : null}

      <input
        {...rest}
        type="date"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className={cx(
          FIELD_BASE,
          "[color-scheme:dark]",
          error && FIELD_ERROR,
          className
        )}
      />

      {error ? (
        <div className={FIELD_ERROR_TEXT}>{error}</div>
      ) : hint ? (
        <div className={FIELD_HINT}>{hint}</div>
      ) : null}
    </div>
  );
}