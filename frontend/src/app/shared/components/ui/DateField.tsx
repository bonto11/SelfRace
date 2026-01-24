// src/app/shared/components/ui/DateField.tsx
"use client";

import * as React from "react";
import TextField from "@/app/shared/components/ui/TextField";

/**
 * Uniformný date input:
 * - UI je identické s TextField (lebo to JE TextField)
 * - ukladáme ISO "YYYY-MM-DD" (alebo null)
 */
type Props = {
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string; // default: YYYY-MM-DD
  disabled?: boolean;
};

function normalizeIsoDate(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;

  // povolíme len YYYY-MM-DD
  // rýchla validácia: 4-2-2 + čísla
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;

  // jednoduchý check reálneho dátumu
  const d = new Date(v + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return null;

  // späť do ISO (aby sme mali presný formát)
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
      value={value ?? ""}
      disabled={disabled}
      onChange={(e) => {
        const raw = e.target.value;

        // nechaj písať, ale do state ulož buď valid ISO alebo null
        // UX: ak chceš, môžeme spraviť “len sanitize”, ale toto je čisté a predvídateľné
        const iso = normalizeIsoDate(raw);
        if (raw.trim() === "") onChange(null);
        else if (iso) onChange(iso);
        else onChange(raw.trim()); // dočasne drží nevalidný text (vidí čo píše)
      }}
    />
  );
}