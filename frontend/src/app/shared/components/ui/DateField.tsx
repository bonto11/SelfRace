"use client";

import * as React from "react";
import { cx } from "@/app/shared/ui";
import { FIELD_BASE, FIELD_ERROR } from "@/app/shared/ui/tokens";

type Props = {
  value?: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  min?: string;
  max?: string;
  className?: string;
  error?: boolean;
};

export default function DateField({
  value,
  onChange,
  disabled,
  min,
  max,
  className,
  error,
}: Props) {
  return (
    <input
      type="date"
      value={value ?? ""}
      disabled={disabled}
      min={min}
      max={max}
      onChange={(e) => onChange(e.target.value ? e.target.value : null)}
      className={cx(
        FIELD_BASE,
        "w-full [color-scheme:dark]",
        error && FIELD_ERROR,
        className
      )}
    />
  );
}