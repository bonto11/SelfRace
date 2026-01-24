// src/app/shared/components/ui/DateField.tsx
"use client";

import type { ChangeEvent } from "react";
import {
  FIELD_INLINE,
  DATE_FIELD_LABEL,
  DATE_INPUT_INNER,
} from "@/app/shared/ui/tokens";

type Props = {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  min?: string;
  max?: string;
};

export default function DateField({ label, value, onChange, min, max }: Props) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.trim();
    onChange(v || null);
  };

  return (
    <label className="flex flex-col gap-1">
      <span className={DATE_FIELD_LABEL}>{label}</span>

      <div className={FIELD_INLINE}>
        <input
          type="date"
          value={value ?? ""}
          onChange={handleChange}
          min={min}
          max={max}
          className={DATE_INPUT_INNER}
        />
      </div>
    </label>
  );
}