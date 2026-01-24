"use client";

import * as React from "react";
import TextField from "@/app/shared/components/ui/TextField";

type Props = {
  value?: string | null;              // ✅ akceptuje aj undefined
  onChange: (value: string | null) => void;
  placeholder?: string;              // default: YYYY-MM-DD
  disabled?: boolean;
};

function normalizeIsoDate(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;

  // povolíme len YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;

  const d = new Date(v + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return null;

  const iso = d.toISOString().slice(0, 10);
  return iso === v ? iso : null;
}

export default function DateField({
  value,
  onChange,
  placeholder = "YYYY-MM-DD",
  disabled,
}: Props) {
  return (
    <TextField
      type="text"
      inputMode="numeric"
      placeholder={placeholder}
      value={value ?? ""}             // ✅ undefined -> ""
      disabled={disabled}
      onChange={(e) => {
        const raw = e.target.value;

        if (raw.trim() === "") {
          onChange(null);
          return;
        }

        const iso = normalizeIsoDate(raw);

        // drž v state iba null alebo valid ISO
        // (žiadne "dočasné nevalidné stringy" -> stabilnejšie typy všade)
        onChange(iso);
      }}
    />
  );
}