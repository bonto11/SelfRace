// src/app/shared/ui/components/Checkbox.tsx
"use client";

import * as React from "react";
import { cx } from "@/app/shared/ui/utils/inputs";
import {
  CHECKBOX_ROW,
  CHECKBOX_BOX_READONLY,
  CHECKBOX_BOX_EDITABLE,
  CHECKBOX_BOX_READONLY_STYLE,
  CHECKBOX_BOX_EDITABLE_STYLE,
  CHECKBOX_LABEL,
  CHECKBOX_HINT,
  FORM_TEXT_VARS,
} from "@/app/shared/ui/tokens";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  variant?: "readonly" | "editable";
  containerClassName?: string;
  labelClassName?: string;
  checkboxClassName?: string;
};

export default function Checkbox({
  label,
  hint,
  variant = "editable",
  containerClassName,
  labelClassName,
  checkboxClassName,
  className,
  id,
  disabled,
  ...rest
}: Props) {
  const autoId = React.useId();
  const inputId = id ?? autoId;

  const editable = variant === "editable";
  const boxClass = editable ? CHECKBOX_BOX_EDITABLE : CHECKBOX_BOX_READONLY;
  const boxStyle = {
    ...(editable ? CHECKBOX_BOX_EDITABLE_STYLE : CHECKBOX_BOX_READONLY_STYLE),
    ...FORM_TEXT_VARS,
  } as React.CSSProperties;

  const effectiveDisabled = disabled || !editable;

  return (
    <label
      className={cx(CHECKBOX_ROW, containerClassName)}
      htmlFor={inputId}
      style={boxStyle}
    >
      <input
        {...rest}
        id={inputId}
        type="checkbox"
        disabled={effectiveDisabled}
        className={cx(boxClass, checkboxClassName, className)}
      />

      {(label != null || hint != null) && (
        <span className={cx(CHECKBOX_LABEL, labelClassName)}>
          {label != null ? <span>{label}</span> : null}
          {hint != null ? <span className={CHECKBOX_HINT}>{hint}</span> : null}
        </span>
      )}
    </label>
  );
}
