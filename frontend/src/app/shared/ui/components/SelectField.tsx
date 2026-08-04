// src/app/shared/ui/components/SelectField.tsx
"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cx } from "@/app/shared/ui/utils/inputs";
import {
  FIELD_READONLY_BASE,
  FIELD_EDITABLE_BASE,
  FIELD_READONLY_STYLE,
  FIELD_EDITABLE_STYLE,
  FIELD_ERROR,
  FIELD_ERROR_STYLE,
  FIELD_ERROR_TEXT,
  FIELD_HINT,
  FIELD_LABEL,
  FORM_TEXT_VARS,
  SELECT_BTN,
  SELECT_ICON,
  SELECT_MENU,
  SELECT_MENU_WRAP,
  SELECT_MENU_READONLY,
  SELECT_MENU_EDITABLE,
  SELECT_MENU_READONLY_STYLE,
  SELECT_MENU_EDITABLE_STYLE,
  SELECT_OPT,
  SELECT_OPT_ACTIVE,
  SELECT_OPT_EMPTY,
  SELECT_OPT_READONLY_STYLE,
  SELECT_OPT_EDITABLE_STYLE,
} from "@/app/shared/ui/tokens";

type Option = { value: string; label: string };

export type SelectChangeEvent = {
  target: { value: string };
  currentTarget: { value: string };
  preventDefault: () => void;
  stopPropagation: () => void;
};

type Props = {
  label?: string;
  hint?: string;
  error?: string;
  disabled?: boolean;
  value: string;

  /** HTML-like API (optional) */
  onChange?: (e: SelectChangeEvent) => void;

  /** Preferované API */
  onValueChange?: (value: string) => void;

  options: Option[];
  placeholder?: string;
  containerClassName?: string;
  variant?: "readonly" | "editable";
};

export default function SelectField({
  label,
  hint,
  error,
  disabled,
  value,
  onChange,
  onValueChange,
  options,
  placeholder = "—",
  containerClassName,
  variant = "editable",
}: Props) {
  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement | null>(null);
  const btnRef = React.useRef<HTMLButtonElement | null>(null);
  const menuRef = React.useRef<HTMLDivElement | null>(null);

  const editable = variant === "editable";
  const baseClass = editable ? FIELD_EDITABLE_BASE : FIELD_READONLY_BASE;
  const effectiveDisabled = disabled || !editable;

  const selected = options.find((o) => o.value === value) ?? null;
  const display = selected?.label ?? (value ? value : placeholder);

  const wrapStyle = {
    ...(editable ? FIELD_EDITABLE_STYLE : FIELD_READONLY_STYLE),
    ...(error ? FIELD_ERROR_STYLE : null),
    ...FORM_TEXT_VARS,
  } as React.CSSProperties;

  const menuVariantClass = editable
    ? SELECT_MENU_EDITABLE
    : SELECT_MENU_READONLY;
  const menuStyle = {
    ...(editable ? SELECT_MENU_EDITABLE_STYLE : SELECT_MENU_READONLY_STYLE),
    ...(editable ? SELECT_OPT_EDITABLE_STYLE : SELECT_OPT_READONLY_STYLE),
    ...FORM_TEXT_VARS,
  } as React.CSSProperties;

  const [pos, setPos] = React.useState<{
    left: number;
    top: number;
    width: number;
  } | null>(null);

  function close() {
    setOpen(false);
    setPos(null);
  }

  React.useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      close();
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }

    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  function emit(next: string) {
    const evt: SelectChangeEvent = {
      target: { value: next },
      currentTarget: { value: next },
      preventDefault: () => {},
      stopPropagation: () => {},
    };

    //  nič nerozbije: staré usage s onChange funguje
    onChange?.(evt);

    // nové usage (TrendPareto8020) funguje aj bez onChange
    onValueChange?.(next);
  }

  React.useEffect(() => {
    if (!open) return;
    const el = btnRef.current;
    if (!el) return;

    const update = () => {
      const r = el.getBoundingClientRect();
      setPos({ left: r.left, top: r.bottom + 8, width: r.width });
    };

    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  return (
    <div
      className={cx("space-y-1", containerClassName)}
      ref={wrapRef}
      style={wrapStyle}
    >
      {label ? <label className={FIELD_LABEL}>{label}</label> : null}

      <div className={SELECT_MENU_WRAP}>
        <button
          ref={btnRef}
          type="button"
          disabled={effectiveDisabled}
          onClick={() => {
            if (effectiveDisabled) return;
            setOpen((v) => !v);
          }}
          className={cx(
            baseClass,
            SELECT_BTN,
            !selected && !value && SELECT_OPT_EMPTY,
            error && FIELD_ERROR,
          )}
          aria-expanded={open}
        >
          <span className="truncate">{display}</span>
          <svg viewBox="0 0 16 16" aria-hidden="true" className={SELECT_ICON}>
            <path
              d="M3 6.25L8 11l5-4.75"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {open && !effectiveDisabled && pos
          ? createPortal(
              <div
                ref={menuRef}
                className={cx(SELECT_MENU, menuVariantClass)}
                role="listbox"
                style={{
                  ...menuStyle,
                  position: "fixed",
                  left: pos.left,
                  top: pos.top,
                  width: pos.width,
                  zIndex: 999999,
                }}
              >
                {options.map((o) => {
                  const active = value === o.value;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      className={cx(SELECT_OPT, active && SELECT_OPT_ACTIVE)}
                      onClick={() => {
                        close();
                        emit(o.value);
                      }}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>,
              document.body,
            )
          : null}
      </div>

      {error ? (
        <div className={FIELD_ERROR_TEXT}>{error}</div>
      ) : hint ? (
        <div className={FIELD_HINT}>{hint}</div>
      ) : null}
    </div>
  );
}
