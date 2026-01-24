"use client";

import {
  FIELD_INLINE,
  FIELD_LABEL,
  FIELD_SELECT,
  FIELD_OPTION,
} from "@/app/shared/ui/tokens";

type Props = {
  label: string;
  value: string | null; // "HH:MM"
  onChange: (value: string | null) => void;
};

function parseTime(v: string | null): { h: string; m: string } {
  if (!v) return { h: "18", m: "00" };
  const parts = v.split(":");
  if (parts.length !== 2) return { h: "18", m: "00" };
  let [h, m] = parts;
  const hi = Math.min(23, Math.max(0, Number(h) || 0));
  const mi = Math.min(59, Math.max(0, Number(m) || 0));
  return {
    h: String(hi).padStart(2, "0"),
    m: String(mi).padStart(2, "0"),
  };
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 12 }, (_, i) =>
  String(i * 5).padStart(2, "0")
);

export default function TimeField24({ label, value, onChange }: Props) {
  const { h, m } = parseTime(value);

  return (
    <label className="flex flex-col gap-1">
      <span className={FIELD_LABEL}>{label}</span>

      <div className={[FIELD_INLINE, "flex items-center gap-2"].join(" ")}>
        <select
          value={h}
          onChange={(e) => onChange(`${e.target.value}:${m}`)}
          className={FIELD_SELECT}
        >
          {HOURS.map((hh) => (
            <option key={hh} value={hh} className={FIELD_OPTION}>
              {hh}
            </option>
          ))}
        </select>

        <span className="text-sm opacity-70">:</span>

        <select
          value={m}
          onChange={(e) => onChange(`${h}:${e.target.value}`)}
          className={FIELD_SELECT}
        >
          {MINUTES.map((mm) => (
            <option key={mm} value={mm} className={FIELD_OPTION}>
              {mm}
            </option>
          ))}
        </select>
      </div>
    </label>
  );
}