// DateField.tsx
"use client";
import * as React from "react";
import { cx } from "@/app/shared/ui";
import {
  FIELD_EDITABLE_BASE,
  FIELD_READONLY_BASE,
  FIELD_EDITABLE_STYLE,
  FIELD_READONLY_STYLE,
  FORM_TEXT_VARS,
} from "@/app/shared/ui/tokens";

type Props = {
  value?: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  min?: string;
  max?: string;
  className?: string;
  variant?: "readonly" | "editable";
};

export default function DateField({
  value,
  onChange,
  disabled,
  min,
  max,
  className,
  variant = "editable",
}: Props) {
  const editable = variant === "editable";
  const effectiveDisabled = disabled || !editable;

  const baseClass = editable ? FIELD_EDITABLE_BASE : FIELD_READONLY_BASE;

  const style = {
    ...(editable ? FIELD_EDITABLE_STYLE : FIELD_READONLY_STYLE),
    ...FORM_TEXT_VARS,
  } as React.CSSProperties;

  const display = value
    ? (() => {
        try {
          const d = new Date(value + "T00:00:00");
          return d.toLocaleDateString();
        } catch {
          return value;
        }
      })()
    : "—";

  return (
    <div style={style} className={cx(baseClass, "relative w-full", className)}>
      <span className={cx("block truncate", !value && "opacity-60")}>
        {display}
      </span>

      <input
        type="date"
        value={value ?? ""}
        disabled={effectiveDisabled}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value ? e.target.value : null)}
        className="absolute inset-0 w-full h-full opacity-0"
      />
    </div>
  );
}