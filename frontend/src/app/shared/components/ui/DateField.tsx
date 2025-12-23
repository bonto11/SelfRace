"use client";

import type { ChangeEvent } from "react";
import { SURFACE_INLINE } from "@/app/shared/ui/classes";

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
    <label className="flex flex-col gap-1 text-xs">
      <span className="opacity-80">{label}</span>
      <div className={[SURFACE_INLINE, "px-3 py-2"].join(" ")}>
        <input
          type="date"
          value={value ?? ""}
          onChange={handleChange}
          min={min}
          max={max}
          className="w-full bg-transparent text-sm outline-none border-none focus:outline-none"
        />
      </div>
    </label>
  );
}
