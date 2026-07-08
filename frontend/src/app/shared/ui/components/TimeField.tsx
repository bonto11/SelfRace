// TimeField.tsx
"use client";
import * as React from "react";
import { cx } from "@/app/shared/ui/utils/inputs";
import {
  FIELD_EDITABLE_BASE,
  FIELD_READONLY_BASE,
  FIELD_EDITABLE_STYLE,
  FIELD_READONLY_STYLE,
  FIELD_ERROR,
  FIELD_ERROR_STYLE,
  FIELD_LABEL,
  FIELD_HINT,
  FIELD_ERROR_TEXT,
  FORM_TEXT_VARS,
} from "@/app/shared/ui/tokens";

type Props = {
  label?: string;
  hint?: string;
  error?: string;
  containerClassName?: string;
  className?: string;
  variant?: "readonly" | "editable";
  disabled?: boolean;
  /** Ktoré segmenty čas obsahuje. Default: hh + mm. */
  hh?: boolean;
  mm?: boolean;
  ss?: boolean;
  /** Hodnota vo formáte "HH:MM", "HH:MM:SS" alebo "MM:SS" podľa aktívnych segmentov. */
  value: string;
  onChange: (val: string) => void;
  showReset?: boolean;
};

// Vytvorí prázdnu hodnotu podľa aktívnych segmentov, napr. "00:00" alebo "00:00:00"
function emptyValue(hh: boolean, mm: boolean, ss: boolean): string {
  const parts: string[] = [];
  if (hh) parts.push("00");
  if (mm) parts.push("00");
  if (ss) parts.push("00");
  return parts.join(":");
}

// Extrahuje čisté číslice z hocijakého vstupu (aj so zadanými dvojbodkami)
function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

// Naformátuje reťazec čistých číslic späť na "HH:MM(:SS)" podľa segmentov,
// pričom priebežne vkladá dvojbodky ako píšeš.
function formatDigits(digits: string, segCount: number): string {
  const maxLen = segCount * 2;
  const clipped = digits.slice(0, maxLen);
  const groups: string[] = [];
  for (let i = 0; i < clipped.length; i += 2) {
    groups.push(clipped.slice(i, i + 2));
  }
  return groups.join(":");
}

// Zarovná a orezá jednotlivé segmenty na platné rozsahy (0-23 pre hh, 0-59 pre mm/ss)
function clampSegments(digits: string, segCount: number): string {
  const maxLen = segCount * 2;
  const clipped = digits.slice(0, maxLen);
  const groups: string[] = [];
  for (let i = 0; i < clipped.length; i += 2) {
    groups.push(clipped.slice(i, i + 2));
  }

  return groups
    .map((g, idx) => {
      if (g.length < 2) return g; // ešte nekompletný segment, nezasahujeme
      let n = parseInt(g, 10);
      const isHour = idx === 0 && segCount === 3 ? true : idx === 0 && segCount === 2 ? true : false;
      // Prvý segment je hodiny len ak `hh` je aktívne — riešime to v handleBlur cez segMax
      const max = 59;
      if (n > max) n = max;
      return String(n).padStart(2, "0");
    })
    .join(":");
}

export default function TimeField({
  label,
  hint,
  error,
  containerClassName,
  className,
  variant = "editable",
  disabled,
  hh = true,
  mm = true,
  ss = false,
  value,
  onChange,
  showReset = true,
}: Props) {
  const editable = variant === "editable";
  const effectiveDisabled = disabled || !editable;

  const baseClass = editable ? FIELD_EDITABLE_BASE : FIELD_READONLY_BASE;

  const style = {
    ...(editable ? FIELD_EDITABLE_STYLE : FIELD_READONLY_STYLE),
    ...(error ? FIELD_ERROR_STYLE : null),
    ...FORM_TEXT_VARS,
  } as React.CSSProperties;

  const segCount = [hh, mm, ss].filter(Boolean).length;
  const segMaxes = [hh ? 23 : 59, 59, 59]; // poradie podľa aktívnych segmentov

  const hasValue = value !== "" && value !== emptyValue(hh, mm, ss);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;

    if (raw === "") {
      onChange("");
      return;
    }

    const digits = digitsOnly(raw);
    const formatted = formatDigits(digits, segCount);
    onChange(formatted);
  }

  function handleBlur() {
    if (value === "") return;

    const digits = digitsOnly(value);
    if (!digits) {
      onChange("");
      return;
    }

    const maxLen = segCount * 2;
    const padded = digits.padEnd(maxLen, "0").slice(0, maxLen);

    const groups: string[] = [];
    for (let i = 0; i < padded.length; i += 2) {
      groups.push(padded.slice(i, i + 2));
    }

    const clamped = groups.map((g, idx) => {
      let n = parseInt(g, 10);
      if (Number.isNaN(n)) n = 0;
      const max = segMaxes[idx] ?? 59;
      if (n > max) n = max;
      return String(n).padStart(2, "0");
    });

    onChange(clamped.join(":"));
  }

  function handleReset() {
    onChange("");
  }

  const placeholder = emptyValue(hh, mm, ss);

  return (
    <div className={cx("space-y-1", containerClassName)} style={style}>
      {label ? <label className={FIELD_LABEL}>{label}</label> : null}

      <div className="relative">
        <input
          type="text"
          inputMode="numeric"
          value={value}
          placeholder={placeholder}
          disabled={effectiveDisabled}
          onChange={handleChange}
          onBlur={handleBlur}
          className={cx(
            baseClass,
            error && FIELD_ERROR,
            showReset && hasValue ? "pr-9" : "",
            className
          )}
        />

        {showReset && hasValue && !effectiveDisabled && (
          <button
            type="button"
            onClick={handleReset}
            aria-label="Reset"
            className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center text-[11px] leading-none opacity-50 hover:opacity-90 transition-opacity"
            style={{ color: "#111111", border: "1px solid currentColor" }}
          >
            ✕
          </button>
        )}
      </div>

      {error ? (
        <div className={FIELD_ERROR_TEXT}>{error}</div>
      ) : hint ? (
        <div className={FIELD_HINT}>{hint}</div>
      ) : null}
    </div>
  );
}
