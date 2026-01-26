"use client";

import * as React from "react";
import { cx } from "@/app/shared/ui";
import { FIELD_BASE_READONLY } from "@/app/shared/ui/tokens";

type Props = {
  value?: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  min?: string;
  max?: string;
  className?: string;
};

export default function DateField({
  value,
  onChange,
  disabled,
  min,
  max,
  className,
}: Props) {
  const display = value
    ? (() => {
        try {
          // zobraz lokálne (iOS pekne)
          const d = new Date(value + "T00:00:00");
          return d.toLocaleDateString();
        } catch {
          return value;
        }
      })()
    : "—";

  return (
    <div className={cx(FIELD_BASE_READONLY, "relative w-full", className)}>
      <span className={cx("block truncate", !value && "text-white/50")}>
        {display}
      </span>

      <input
        type="date"
        value={value ?? ""}
        disabled={disabled}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value ? e.target.value : null)}
        className="absolute inset-0 w-full h-full opacity-0"
      />
    </div>
  );
}