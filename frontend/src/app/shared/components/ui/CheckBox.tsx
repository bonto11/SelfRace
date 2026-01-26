"use client";

import * as React from "react";
import { cx } from "@/app/shared/ui";
import {
  CHECKBOX_ROW,
  CHECKBOX_BOX,
  CHECKBOX_LABEL,
  CHECKBOX_HINT,
} from "@/app/shared/ui/tokens";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label?: React.ReactNode;
  hint?: React.ReactNode;

  containerClassName?: string;
  labelClassName?: string;
  checkboxClassName?: string;
};

export default function Checkbox({
  id,
  label,
  hint,
  disabled,

  containerClassName,
  labelClassName,
  checkboxClassName,
  className,

  ...rest
}: Props) {
  const autoId = React.useId();
  const inputId = id ?? `cb-${autoId}`;

  return (
    <label
      htmlFor={inputId}
      className={cx(
        CHECKBOX_ROW,
        disabled ? "cursor-not-allowed" : "cursor-pointer",
        containerClassName
      )}
    >
      <input
        {...rest}
        id={inputId}
        type="checkbox"
        disabled={disabled}
        className={cx(CHECKBOX_BOX, checkboxClassName, className)}
      />

      <span className={cx(CHECKBOX_LABEL, labelClassName)}>
        {label}
        {hint ? <span className={CHECKBOX_HINT}>{hint}</span> : null}
      </span>
    </label>
  );
}