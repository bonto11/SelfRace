// src/app/shared/i18n/LangSelector.tsx
"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { cx } from "@/app/shared/ui/utils/inputs";
import { useSettings, type AppLang } from "./SettingsProvider";
import {
  FORM_TEXT_VARS,
  SELECT_ICON,
  SELECT_MENU,
  SELECT_MENU_WRAP,
  SELECT_MENU_READONLY,
  SELECT_MENU_EDITABLE,
  SELECT_MENU_READONLY_STYLE,
  SELECT_MENU_EDITABLE_STYLE,
  SELECT_OPT,
  SELECT_OPT_ACTIVE,
  SELECT_OPT_READONLY_STYLE,
  SELECT_OPT_EDITABLE_STYLE,
} from "@/app/shared/ui/tokens";

type Props = {
  variant?: "readonly" | "editable";
  disabled?: boolean;
  className?: string;
  size?: "xs" | "sm" | "md";
};

const LANGS: Array<{
  value: AppLang;
  name: string;
  flagSrc: string;
  short: string;
}> = [
  { value: "sk", name: "Slovenčina", flagSrc: "/flags/sk.png", short: "SK" },
  { value: "en", name: "English", flagSrc: "/flags/en.png", short: "EN" },
];

export default function LangSelector({
  variant = "readonly",
  disabled,
  className,
  size = "sm",
}: Props) {
  const { lang, setLang } = useSettings();

  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement | null>(null);
  const btnRef = React.useRef<HTMLButtonElement | null>(null);
  const menuRef = React.useRef<HTMLDivElement | null>(null);

  const editable = variant === "editable";
  const effectiveDisabled = !!disabled || !editable;

  const menuVariantClass = editable ? SELECT_MENU_EDITABLE : SELECT_MENU_READONLY;
  const menuStyle = {
    ...(editable ? SELECT_MENU_EDITABLE_STYLE : SELECT_MENU_READONLY_STYLE),
    ...(editable ? SELECT_OPT_EDITABLE_STYLE : SELECT_OPT_READONLY_STYLE),
    ...FORM_TEXT_VARS,
  } as React.CSSProperties;

  const current = LANGS.find((x) => x.value === lang) ?? LANGS[0];

  const [pos, setPos] = React.useState<{ left: number; top: number; width: number } | null>(null);

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
    document.addEventListener("mousedown", onDocClick, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick, true);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

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

  // kruh button sizing
  const circleCls =
    size === "xs" ? "h-8 w-8"
    : size === "md" ? "h-10 w-10"
    : "h-9 w-9";

  return (
    <div ref={wrapRef} className={cx("relative", className)}>
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
            "inline-flex items-center justify-center rounded-full border",
            "bg-white/5 border-white/10 hover:bg-white/10",
            "transition-colors",
            circleCls,
          )}
          aria-expanded={open}
          aria-label="Language selector"
        >
          <Image
            src={current.flagSrc}
            alt=""
            width={18}
            height={18}
            className="h-[18px] w-[18px] rounded-sm"
            draggable={false}
          />
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
                  width: 220,
                  zIndex: 999999,
                }}
              >
                {LANGS.map((o) => {
                  const active = lang === o.value;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      className={cx(
                        SELECT_OPT,
                        active && SELECT_OPT_ACTIVE,
                        "flex items-center gap-2",
                      )}
                      onClick={async () => {
                        close();
                        await setLang(o.value);
                      }}
                    >
                      <Image
                        src={o.flagSrc}
                        alt=""
                        width={18}
                        height={18}
                        className="h-[18px] w-[18px] rounded-sm"
                        draggable={false}
                      />
                      <span className="flex-1 text-left">{o.name}</span>
                      <span className="text-xs opacity-70">{o.short}</span>
                      <svg viewBox="0 0 16 16" aria-hidden="true" className={cx(SELECT_ICON, "opacity-0")} />
                    </button>
                  );
                })}
              </div>,
              document.body,
            )
          : null}
      </div>
    </div>
  );
}