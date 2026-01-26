// src/app/shared/components/ui/Checkbox.tsx
"use client";

import * as React from "react";
import { cx } from "@/app/shared/ui";
import {
  CHECKBOX_ROW,
  CHECKBOX_BOX,
  CHECKBOX_BOX_EDITABLE,
  CHECKBOX_LABEL,
  CHECKBOX_HINT,
} from "@/app/shared/ui/tokens";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  variant?: "default" | "editable";
  containerClassName?: string;
  labelClassName?: string;
  checkboxClassName?: string;
};

export default function Checkbox({
  label,
  hint,
  variant = "default",
  containerClassName,
  labelClassName,
  checkboxClassName,
  className,
  id,
  ...rest
}: Props) {
  const boxClass = variant === "editable" ? CHECKBOX_BOX_EDITABLE : CHECKBOX_BOX;

  // ak user nedá id, vygenerujeme stabilný (React 18)
  const autoId = React.useId();
  const inputId = id ?? autoId;

  return (
    <label className={cx(CHECKBOX_ROW, containerClassName)} htmlFor={inputId}>
      <input
        {...rest}
        id={inputId}
        type="checkbox"
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