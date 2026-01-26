// TextField.tsx
"use client";
import * as React from "react";
import { cx } from "@/app/shared/ui";
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

type Props = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string;
  containerClassName?: string;
  variant?: "readonly" | "editable";
};

export default function TextField({
  label,
  hint,
  error,
  containerClassName,
  className,
  variant = "editable",
  disabled,
  ...rest
}: Props) {
  const editable = variant === "editable";
  const effectiveDisabled = disabled || !editable;

  const baseClass = editable ? FIELD_EDITABLE_BASE : FIELD_READONLY_BASE;

  // vars = (variant vars) + (error vars) + (text vars)
  const style = {
    ...(editable ? FIELD_EDITABLE_STYLE : FIELD_READONLY_STYLE),
    ...(error ? FIELD_ERROR_STYLE : null),
    ...FORM_TEXT_VARS,
  } as React.CSSProperties;

  return (
    <div className={cx("space-y-1", containerClassName)} style={style}>
      {label ? <label className={FIELD_LABEL}>{label}</label> : null}

      <input
        {...rest}
        disabled={effectiveDisabled}
        className={cx(baseClass, error && FIELD_ERROR, className)}
      />

      {error ? (
        <div className={FIELD_ERROR_TEXT}>{error}</div>
      ) : hint ? (
        <div className={FIELD_HINT}>{hint}</div>
      ) : null}
    </div>
  );
}