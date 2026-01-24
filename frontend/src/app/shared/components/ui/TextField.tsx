// src/app/shared/components/ui/TextField.tsx
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

type Props = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string;
  containerClassName?: string;
};

export default function TextField({
  label,
  hint,
  error,
  containerClassName,
  className,
  ...rest
}: Props) {
  return (
    <div className={cx("space-y-1", containerClassName)}>
      {label ? <label className={FIELD_LABEL}>{label}</label> : null}

      <input
        {...rest}
        className={cx(FIELD_BASE, error && FIELD_ERROR, className)}
      />

      {error ? (
        <div className={FIELD_ERROR_TEXT}>{error}</div>
      ) : hint ? (
        <div className={FIELD_HINT}>{hint}</div>
      ) : null}
    </div>
  );
}