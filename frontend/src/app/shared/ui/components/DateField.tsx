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
  DATEFIELD_DISPLAY, // <- pridáme do tokens (nižšie)
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

  const inputRef = React.useRef<HTMLInputElement | null>(null);

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

  function openPicker() {
    if (effectiveDisabled) return;

    const el = inputRef.current;
    if (!el) return;

    // získa focus vždy (kvôli accessibility + keyboard)
    el.focus();

    // Chrome/Edge majú showPicker()
    // Safari často nie, preto fallback klik
    const anyEl = el as any;
    if (typeof anyEl.showPicker === "function") {
      anyEl.showPicker();
    } else {
      el.click();
    }
  }

  return (
    <div
      style={style}
      className={cx(
        baseClass,
        "relative w-full cursor-pointer select-none",
        effectiveDisabled && "cursor-not-allowed",
        className
      )}
      role="button"
      tabIndex={effectiveDisabled ? -1 : 0}
      aria-disabled={effectiveDisabled}
      onClick={openPicker}
      onKeyDown={(e) => {
        if (effectiveDisabled) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openPicker();
        }
      }}
    >
      {/* vycentrovaný text + správne paddingy už dáva FIELD_*_BASE */}
      <span className={cx(DATEFIELD_DISPLAY, !value && "opacity-60")}>
        {display}
      </span>

      {/* skrytý native input – stále tam je kvôli pickeru */}
      <input
        ref={inputRef}
        type="date"
        value={value ?? ""}
        disabled={effectiveDisabled}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value ? e.target.value : null)}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        // zlepší klikateľnosť na PC – nechytá ti to “iba vpravo”
        // (niektoré prehliadače majú natívny UI len na časti)
        style={{ WebkitAppearance: "none", appearance: "none" }}
      />
    </div>
  );
}