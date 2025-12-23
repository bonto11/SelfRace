// src/shared/components/ui/TextField.tsx
"use client";
import * as React from "react";
import { inputClass, labelClass, hintClass, cx } from "@/app/shared/ui";

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
      {label && <label className={labelClass}>{label}</label>}
      <input
        className={cx(inputClass, className, error && "border-red-600")}
        {...rest}
      />
      {error ? (
        <div className="text-xs text-red-400">{error}</div>
      ) : (
        hint && <div className={hintClass}>{hint}</div>
      )}
    </div>
  );
}
