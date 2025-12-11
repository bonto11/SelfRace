"use client";

import { SURFACE_INLINE } from "@/shared/ui/classes";

type Props = {
  label: string;
  value: string | null;            // "HH:MM"
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

const HOURS = Array.from({ length: 24 }, (_, i) =>
  String(i).padStart(2, "0"),
);

// 5-min krok
const MINUTES = Array.from({ length: 12 }, (_, i) =>
  String(i * 5).padStart(2, "0"),
);

export default function TimeField24({ label, value, onChange }: Props) {
  const { h, m } = parseTime(value);

  const handleHour = (newH: string) => {
    onChange(`${newH}:${m}`);
  };
  const handleMinute = (newM: string) => {
    onChange(`${h}:${newM}`);
  };

  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="opacity-80">{label}</span>
      <div
        className={[
          SURFACE_INLINE,
          "px-3 py-2 flex items-center gap-2",
        ].join(" ")}
      >
        <select
          value={h}
          onChange={(e) => handleHour(e.target.value)}
          className="bg-transparent text-sm outline-none border-none focus:outline-none"
        >
          {HOURS.map((hh) => (
            <option key={hh} value={hh}>
              {hh}
            </option>
          ))}
        </select>
        <span className="text-sm opacity-70">:</span>
        <select
          value={m}
          onChange={(e) => handleMinute(e.target.value)}
          className="bg-transparent text-sm outline-none border-none focus:outline-none"
        >
          {MINUTES.map((mm) => (
            <option key={mm} value={mm}>
              {mm}
            </option>
          ))}
        </select>
      </div>
    </label>
  );
}