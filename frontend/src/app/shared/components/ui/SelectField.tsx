"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cx } from "@/app/shared/ui";
import {
  FIELD_BASE_READONLY,
  FIELD_ERROR,
  FIELD_ERROR_TEXT,
  FIELD_HINT,
  FIELD_LABEL,
  SELECT_BTN,
  SELECT_ICON,
  SELECT_MENU,
  SELECT_MENU_WRAP,
  SELECT_OPT,
  SELECT_OPT_ACTIVE,
  SELECT_OPT_EMPTY,
} from "@/app/shared/ui/tokens";

type Option = { value: string; label: string };

type SelectChangeEvent = {
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
  onChange: (e: SelectChangeEvent) => void;
  onValueChange?: (value: string) => void;
  options: Option[];
  placeholder?: string;
  containerClassName?: string;
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
}: Props) {
  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement | null>(null);
  const btnRef = React.useRef<HTMLButtonElement | null>(null);

  const selected = options.find((o) => o.value === value) ?? null;
  const display = selected?.label ?? (value ? value : placeholder);

  const menuRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return; // ✅ portal menu
      setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function emit(next: string) {
    const evt: SelectChangeEvent = {
      target: { value: next },
      currentTarget: { value: next },
      preventDefault: () => {},
      stopPropagation: () => {},
    };
    onChange(evt);
    onValueChange?.(next);
  }

  // vypočítaj pozíciu pre portal menu
  const [pos, setPos] = React.useState<{ left: number; top: number; width: number } | null>(null);

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
    <div className={cx("space-y-1", containerClassName)} ref={wrapRef}>
      {label ? <label className={FIELD_LABEL}>{label}</label> : null}

      <div className={SELECT_MENU_WRAP}>
        <button
          ref={btnRef}
          type="button"
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
          className={cx(
            FIELD_BASE_READONLY,
            SELECT_BTN,
            !selected && !value && SELECT_OPT_EMPTY,
            error && FIELD_ERROR
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

        {open && !disabled && pos
          ? createPortal(
              <div
                ref={menuRef}
                className={SELECT_MENU}
                role="listbox"
                style={{
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
                        setOpen(false);
                        emit(o.value);
                      }}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>,
              document.body
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