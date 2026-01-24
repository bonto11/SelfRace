// src/app/shared/components/ui/SelectField.tsx
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

type Option = { value: string; label: string };

type Props = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "value"> & {
  label?: string;
  hint?: string;
  error?: string;
  containerClassName?: string;
  options?: Option[];
  value: string | null | undefined;
};

export default function SelectField({
  label,
  hint,
  error,
  containerClassName,
  className,
  children,
  options,
  value,
  ...rest
}: Props) {
  const isEmpty = value == null || value === "";

  return (
    <div className={cx("space-y-1", containerClassName)}>
      {label ? <label className={FIELD_LABEL}>{label}</label> : null}

      <div className="relative">
        <select
          {...rest}
          value={value ?? ""}
          className={cx(
            FIELD_BASE,
            "[color-scheme:dark]",
            "appearance-none pr-9",
            isEmpty && "text-white/60",
            error && FIELD_ERROR,
            className
          )}
        >
          {options
            ? options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))
            : children}
        </select>

        <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
          <svg
            viewBox="0 0 16 16"
            aria-hidden="true"
            className="h-3.5 w-3.5 text-white/60"
          >
            <path
              d="M3 6.25L8 11l5-4.75"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>

      {error ? (
        <div className={FIELD_ERROR_TEXT}>{error}</div>
      ) : hint ? (
        <div className={FIELD_HINT}>{hint}</div>
      ) : null}
    </div>
  );
}