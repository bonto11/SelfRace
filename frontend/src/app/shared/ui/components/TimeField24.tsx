// TimeField24.tsx
"use client";

import * as React from "react";
import { cx } from "@/app/shared/ui";
import {
  FIELD_LABEL,
  FIELD_SELECT,
  FIELD_OPTION,
  FIELD_OPTION_READONLY_STYLE,
  FIELD_OPTION_EDITABLE_STYLE,
  FIELD_INLINE_READONLY,
  FIELD_INLINE_EDITABLE,
  FIELD_INLINE_READONLY_STYLE,
  FIELD_INLINE_EDITABLE_STYLE,
  FORM_TEXT_VARS,
} from "@/app/shared/ui/tokens";

type Props = {
  label: string;
  value: string | null; // "HH:MM"
  onChange: (value: string | null) => void;
  variant?: "readonly" | "editable";
  disabled?: boolean;
};

function parseTime(v: string | null): { h: string; m: string } {
  if (!v) return { h: "18", m: "00" };
  const parts = v.split(":");
  if (parts.length !== 2) return { h: "18", m: "00" };
  let [h, m] = parts;
  const hi = Math.min(23, Math.max(0, Number(h) || 0));
  const mi = Math.min(59, Math.max(0, Number(m) || 0));
  return { h: String(hi).padStart(2, "0"), m: String(mi).padStart(2, "0") };
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

export default function TimeField24({
  label,
  value,
  onChange,
  variant = "editable",
  disabled,
}: Props) {
  const editable = variant === "editable";
  const effectiveDisabled = disabled || !editable;

  const { h, m } = parseTime(value);

  const wrapClass = editable ? FIELD_INLINE_EDITABLE : FIELD_INLINE_READONLY;
  const wrapStyle = {
    ...(editable ? FIELD_INLINE_EDITABLE_STYLE : FIELD_INLINE_READONLY_STYLE),
    ...FORM_TEXT_VARS,
  } as React.CSSProperties;

  const optStyle = editable ? FIELD_OPTION_EDITABLE_STYLE : FIELD_OPTION_READONLY_STYLE;

  return (
    <label className="flex flex-col gap-1" style={wrapStyle}>
      <span className={FIELD_LABEL}>{label}</span>

      <div className={cx(wrapClass, "flex items-center gap-2")}>
        <select
          value={h}
          disabled={effectiveDisabled}
          onChange={(e) => onChange(`${e.target.value}:${m}`)}
          className={FIELD_SELECT}
        >
          {HOURS.map((hh) => (
            <option key={hh} value={hh} className={FIELD_OPTION} style={optStyle}>
              {hh}
            </option>
          ))}
        </select>

        <span className="text-sm opacity-70">:</span>

        <select
          value={m}
          disabled={effectiveDisabled}
          onChange={(e) => onChange(`${h}:${e.target.value}`)}
          className={FIELD_SELECT}
        >
          {MINUTES.map((mm) => (
            <option key={mm} value={mm} className={FIELD_OPTION} style={optStyle}>
              {mm}
            </option>
          ))}
        </select>
      </div>
    </label>
  );
}