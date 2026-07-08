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
  hh?: boolean;
  mm?: boolean;
  ss?: boolean;
  /** Hodnota vo formáte "HH:MM", "HH:MM:SS" alebo "MM:SS" podľa aktívnych segmentov. Prázdny string = nevyplnené. */
  value: string;
  onChange: (val: string) => void;
  showReset?: boolean;
};

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

// Vloží dvojbodky do surových číslic po každých 2 znakoch, bez doplňovania núl.
function formatDigitsForDisplay(digits: string): string {
  const groups: string[] = [];
  for (let i = 0; i < digits.length; i += 2) {
    groups.push(digits.slice(i, i + 2));
  }
  return groups.join(":");
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
  const maxDigits = segCount * 2;
  const segMaxes = [hh ? 23 : 59, 59, 59];

  // Interný stav sú vždy čisté číslice ("" keď prázdne), formátovanie na displeji je len derivát.
  const [digits, setDigits] = React.useState<string>(() => digitsOnly(value || ""));

  // Ak sa `value` zmení zvonku (napr. load z DB, reset, prefill), synchronizuj interný stav.
  React.useEffect(() => {
    setDigits(digitsOnly(value || ""));
  }, [value]);

  const displayValue = formatDigitsForDisplay(digits);
  const hasValue = digits.length > 0;

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    const newDigits = digitsOnly(raw).slice(0, maxDigits);
    setDigits(newDigits);

    if (newDigits === "") {
      onChange("");
      return;
    }

    // Počas písania posielame von len kompletné segmenty naformátované,
    // nekompletný posledný segment necháme tak ako je (bez orezania/paddingu).
    onChange(formatDigitsForDisplay(newDigits));
  }

  function handleBlur() {
    if (digits === "") {
      onChange("");
      return;
    }

    const padded = digits.padEnd(maxDigits, "0").slice(0, maxDigits);
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

    const finalDigits = clamped.join("");
    setDigits(finalDigits);
    onChange(clamped.join(":"));
  }

  function handleReset() {
    setDigits("");
    onChange("");
  }

  return (
    <div className={cx("space-y-1", containerClassName)} style={style}>
      {label ? <label className={FIELD_LABEL}>{label}</label> : null}

      <div className="relative">
        <input
          type="text"
          inputMode="numeric"
          value={displayValue}
          placeholder="--:--"
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
