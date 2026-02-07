"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import Image from "next/image";

import { cx } from "@/app/shared/ui/utils/inputs";
import { useSettings, type AppLang } from "@/app/shared/i18n/SettingsProvider";

import {
  // používame tvoje existujúce select menu tokeny
  FORM_TEXT_VARS,

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

  // ⬇️ nové (doplníš v tokens/inputs.ts) – ak nechceš, viem ti dať inline className
  LANG_ICON_BTN,
  LANG_ICON_BTN_STYLE_READONLY,
  LANG_ICON_BTN_STYLE_EDITABLE,
} from "@/app/shared/ui/tokens";

type Props = {
  variant?: "readonly" | "editable";
  disabled?: boolean;
  className?: string;
  size?: "xs" | "sm" | "md";
};

const LANGS: Array<{ value: AppLang; name: string; flagSrc: string; short: string }> = [
  { value: "sk", name: "Slovenčina", flagSrc: "/flags/sk.png", short: "SK" },
  { value: "en", name: "English", flagSrc: "/flags/en.png", short: "EN" },
  { value: "fra", name: "Français", flagSrc: "/flags/fra.png", short: "FR" },
  { value: "it", name: "Italiano", flagSrc: "/flags/it.png", short: "IT" },
  { value: "esp", name: "Español", flagSrc: "/flags/esp.png", short: "ES" },
  { value: "ger", name: "Deutsch", flagSrc: "/flags/ger.png", short: "DE" },
];

function sizePx(size: "xs" | "sm" | "md") {
  if (size === "xs") return 32;
  if (size === "md") return 40;
  return 36; // sm
}

export default function LangSelector({
  variant = "editable",
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

  const current = LANGS.find((x) => x.value === lang) ?? LANGS[0];

  const [pos, setPos] = React.useState<{ left: number; top: number } | null>(null);

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

  React.useEffect(() => {
    if (!open) return;
    const el = btnRef.current;
    if (!el) return;

    const update = () => {
      const r = el.getBoundingClientRect();
      setPos({ left: r.left, top: r.bottom + 8 });
    };

    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  const px = sizePx(size);

  const btnStyle = {
    ...(editable ? LANG_ICON_BTN_STYLE_EDITABLE : LANG_ICON_BTN_STYLE_READONLY),
    ...FORM_TEXT_VARS,
    width: px,
    height: px,
  } as React.CSSProperties;

  const menuVariantClass = editable ? SELECT_MENU_EDITABLE : SELECT_MENU_READONLY;
  const menuStyle = {
    ...(editable ? SELECT_MENU_EDITABLE_STYLE : SELECT_MENU_READONLY_STYLE),
    ...(editable ? SELECT_OPT_EDITABLE_STYLE : SELECT_OPT_READONLY_STYLE),
    ...FORM_TEXT_VARS,
  } as React.CSSProperties;

  return (
    <div ref={wrapRef} className={cx("inline-block", className)}>
      <div className={SELECT_MENU_WRAP}>
        <button
          ref={btnRef}
          type="button"
          disabled={effectiveDisabled}
          onClick={() => {
            if (effectiveDisabled) return;
            setOpen((v) => !v);
          }}
          className={cx(LANG_ICON_BTN)}
          style={btnStyle}
          aria-expanded={open}
          aria-label="Language selector"
          title={current.short}
        >
          <span className="relative block overflow-hidden rounded-full" style={{ width: px - 10, height: px - 10 }}>
            <Image
              src={current.flagSrc}
              alt=""
              fill
              sizes={`${px - 10}px`}
              className="object-cover"
              priority={false}
            />
          </span>
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
                  width: 240,
                  zIndex: 999999,
                }}
              >
                {LANGS.map((o) => {
                  const active = lang === o.value;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      className={cx(SELECT_OPT, active && SELECT_OPT_ACTIVE, "flex items-center gap-2")}
                      onClick={async () => {
                        close();
                        await setLang(o.value);
                      }}
                    >
                      <Image src={o.flagSrc} alt="" width={18} height={18} className="h-[18px] w-[18px] rounded-sm" />
                      <span className="flex-1 text-left">{o.name}</span>
                      <span className="text-xs opacity-70">{o.short}</span>
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