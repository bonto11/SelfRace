// src/app/shared/ui/components/SelectFieldFilter.tsx
"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cx } from "@/app/shared/ui/utils/inputs";
import { appColors } from "@/app/shared/ui/theme/app_colors";
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

  onChange?: (e: SelectChangeEvent) => void;
  onValueChange?: (value: string) => void;

  options: Option[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  containerClassName?: string;
  variant?: "readonly" | "editable";
};

/**
 * SelectField s vyhľadávaním a pevnou výškou menu.
 *
 * SelectField pri veľa options (napr. celý cvikový katalóg) pretečie mimo
 * obrazovky - menu je portálom v position:fixed mimo bežného toku stránky,
 * takže ho nejde scrollovať ani zvonku. Tu má menu max-height + vlastný
 * overflow-y-auto a navyše textové pole na filtrovanie zoznamu.
 */
export default function SelectFieldFilter({
  label,
  hint,
  error,
  disabled,
  value,
  onChange,
  onValueChange,
  options,
  placeholder = "—",
  searchPlaceholder = "Hľadať...",
  emptyLabel = "Žiadne výsledky",
  containerClassName,
  variant = "editable",
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const wrapRef = React.useRef<HTMLDivElement | null>(null);
  const btnRef = React.useRef<HTMLButtonElement | null>(null);
  const menuRef = React.useRef<HTMLDivElement | null>(null);
  const searchRef = React.useRef<HTMLInputElement | null>(null);

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

  const menuVariantClass = editable ? SELECT_MENU_EDITABLE : SELECT_MENU_READONLY;
  const menuStyle = {
    ...(editable ? SELECT_MENU_EDITABLE_STYLE : SELECT_MENU_READONLY_STYLE),
    ...(editable ? SELECT_OPT_EDITABLE_STYLE : SELECT_OPT_READONLY_STYLE),
    ...FORM_TEXT_VARS,
  } as React.CSSProperties;

  // 🌟 FIX: predtým natvrdo text-white/bg-white - na svetlom pozadí menu
  // (SELECT_MENU_EDITABLE_STYLE) bol text takmer neviditeľný. appColors
  // sedí nezávisle od motívu, rovnako ako zvyšok appky.
  const searchInputStyle: React.CSSProperties = {
    color: appColors.textPrimary,
    background: appColors.backgroundAlt,
    borderColor: appColors.surfaceCardBorder,
  };

  const [pos, setPos] = React.useState<{
    left: number;
    top: number;
    width: number;
    maxHeight: number;
  } | null>(null);

  function close() {
    setOpen(false);
    setPos(null);
    setQuery("");
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
    onChange?.(evt);
    onValueChange?.(next);
  }

  React.useEffect(() => {
    if (!open) return;
    const el = btnRef.current;
    if (!el) return;

    const update = () => {
      const r = el.getBoundingClientRect();
      const top = r.bottom + 8;
      const available = window.innerHeight - top - 16;
      const maxHeight = Math.max(160, Math.min(360, available));
      setPos({ left: r.left, top, width: r.width, maxHeight });
    };

    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  React.useEffect(() => {
    if (open) {
      const id = requestAnimationFrame(() => searchRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [open]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [query, options]);

  return (
    <div className={cx("space-y-1", containerClassName)} ref={wrapRef} style={wrapStyle}>
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
                className={cx(SELECT_MENU, menuVariantClass, "flex flex-col")}
                role="listbox"
                style={{
                  ...menuStyle,
                  position: "fixed",
                  left: pos.left,
                  top: pos.top,
                  width: pos.width,
                  maxHeight: pos.maxHeight,
                  zIndex: 999999,
                  overflow: "hidden",
                }}
              >
                <div className="p-1.5 shrink-0">
                  <input
                    ref={searchRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={searchPlaceholder}
                    className="w-full rounded border px-3 py-2 text-sm focus:outline-none"
                    style={searchInputStyle}
                  />
                </div>

                <div className="overflow-y-auto min-h-0">
                  {filtered.map((o) => {
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
                  {filtered.length === 0 && (
                    <div className="px-3 py-3 text-xs opacity-40">{emptyLabel}</div>
                  )}
                </div>
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
