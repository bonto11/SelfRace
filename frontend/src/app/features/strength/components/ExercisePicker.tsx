// src/app/features/strength/components/ExercisePicker.tsx
"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useT } from "@/app/shared/i18n/useT";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { STRENGTH_CATALOG_FE } from "@/app/features/strength/constants/strengthCatalog";
import {
  MUSCLE_GROUPS,
  primaryMuscles,
  worksMuscle,
  type MuscleKey,
} from "@/app/features/strength/constants/strengthMuscles";
import {
  FIELD_EDITABLE_BASE,
  FIELD_EDITABLE_STYLE,
  FIELD_LABEL,
  FORM_TEXT_VARS,
  SELECT_BTN,
  SELECT_ICON,
  SELECT_OPT_EMPTY,
} from "@/app/shared/ui/tokens";

/** Nad modalmi (ManualSessionForm, ExerciseSuggestionModal majú 2147483000). */
const MENU_Z_INDEX = 2147483600;

type Props = {
  label?: string;
  value: string;
  onValueChange: (exerciseId: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Skryje štítok s partiami pod názvom cviku (napr. v hustom zozname sérií). */
  hideMuscleHint?: boolean;
};

/**
 * 🌟 NOVÉ: výber cviku s filtrom podľa svalovej partie.
 *
 * Katalóg má cez 80 cvikov a hľadanie podľa názvu funguje len vtedy, keď
 * user vie, ako sa cvik volá. Tlačidlá partií ("Prsia", "Chrbát") sú to,
 * ako nad tréningom reálne rozmýšľa.
 *
 * Filter berie aj pomocné partie (bench sa nájde aj pod tricepsom), takže
 * user nájde, čo hľadá, aj keď to nie je hlavný hýbateľ.
 */
export default function ExercisePicker({
  label,
  value,
  onValueChange,
  placeholder,
  disabled,
  hideMuscleHint = false,
}: Props) {
  const t = useT();
  const lang = (t as any)?.locale?.startsWith("en") ? "en" : "sk";

  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [muscle, setMuscle] = React.useState<MuscleKey | null>(null);

  const wrapRef = React.useRef<HTMLDivElement | null>(null);
  const btnRef = React.useRef<HTMLButtonElement | null>(null);
  const menuRef = React.useRef<HTMLDivElement | null>(null);
  const searchRef = React.useRef<HTMLInputElement | null>(null);

  const [pos, setPos] = React.useState<{
    left: number;
    top: number;
    width: number;
    maxHeight: number;
  } | null>(null);

  const name = React.useCallback(
    (id: string) =>
      (STRENGTH_CATALOG_FE as any)[id]?.[lang] ?? id.replace(/_/g, " "),
    [lang],
  );

  const muscleLabel = React.useCallback(
    (m: MuscleKey) => t(`muscleVolume.muscles.${m}` as any) as string,
    [t],
  );

  const allOptions = React.useMemo(
    () =>
      Object.keys(STRENGTH_CATALOG_FE)
        .map((id) => ({ id, label: name(id) }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [name],
  );

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return allOptions.filter((o) => {
      if (muscle && !worksMuscle(o.id, muscle)) return false;
      if (!q) return true;
      return o.label.toLowerCase().includes(q) || o.id.includes(q);
    });
  }, [allOptions, query, muscle]);

  function close() {
    setOpen(false);
    setPos(null);
    setQuery("");
    setMuscle(null);
  }

  React.useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node;
      if (wrapRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
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
      const top = r.bottom + 8;
      const available = window.innerHeight - top - 16;
      setPos({
        left: r.left,
        top,
        width: r.width,
        maxHeight: Math.max(220, Math.min(420, available)),
      });
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
    if (!open) return;
    const id = requestAnimationFrame(() => searchRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  const selectedLabel = value
    ? name(value)
    : (placeholder ?? t("strengthLog.searchExercise"));
  const selectedMuscles = value && !hideMuscleHint ? primaryMuscles(value) : [];

  return (
    <div
      className="space-y-1"
      ref={wrapRef}
      style={{ ...FIELD_EDITABLE_STYLE, ...FORM_TEXT_VARS }}
    >
      {label ? <label className={FIELD_LABEL}>{label}</label> : null}

      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={[
          FIELD_EDITABLE_BASE,
          SELECT_BTN,
          !value ? SELECT_OPT_EMPTY : "",
        ].join(" ")}
        aria-expanded={open}
      >
        <span className="truncate">{selectedLabel}</span>
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

      {selectedMuscles.length > 0 && (
        <div className="text-[10px] opacity-50">
          {selectedMuscles.map(muscleLabel).join(" · ")}
        </div>
      )}

      {open && !disabled && pos
        ? createPortal(
            <div
              ref={menuRef}
              className="rounded-xl border flex flex-col shadow-xl"
              style={{
                position: "fixed",
                left: pos.left,
                top: pos.top,
                width: pos.width,
                maxHeight: pos.maxHeight,
                zIndex: MENU_Z_INDEX,
                overflow: "hidden",
                background: appColors.surfaceCard,
                borderColor: appColors.surfaceCardBorder,
                color: appColors.textPrimary,
              }}
            >
              {/* Hľadanie */}
              <div className="p-2 shrink-0">
                <input
                  ref={searchRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("strengthLog.searchExercise")}
                  className="w-full rounded border px-3 py-2 text-sm focus:outline-none"
                  style={{
                    color: appColors.textPrimary,
                    background: appColors.backgroundAlt,
                    borderColor: appColors.surfaceCardBorder,
                  }}
                />
              </div>

              {/* Filter podľa partie */}
              <div
                className="px-2 pb-2 shrink-0 flex gap-1.5 overflow-x-auto"
                style={{ WebkitOverflowScrolling: "touch" }}
              >
                <button
                  type="button"
                  onClick={() => setMuscle(null)}
                  className="shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors"
                  style={{
                    background:
                      muscle === null ? appColors.buttonMainBg : "transparent",
                    color:
                      muscle === null
                        ? appColors.buttonMainText
                        : appColors.textSecondary,
                    border: `1px solid ${
                      muscle === null
                        ? appColors.buttonMainBg
                        : appColors.surfaceCardBorder
                    }`,
                  }}
                >
                  {t("muscleVolume.filterAll" as any)}
                </button>
                {MUSCLE_GROUPS.map((m) => {
                  const active = muscle === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMuscle(active ? null : m)}
                      className="shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors"
                      style={{
                        background: active
                          ? appColors.buttonMainBg
                          : "transparent",
                        color: active
                          ? appColors.buttonMainText
                          : appColors.textSecondary,
                        border: `1px solid ${
                          active
                            ? appColors.buttonMainBg
                            : appColors.surfaceCardBorder
                        }`,
                      }}
                    >
                      {muscleLabel(m)}
                    </button>
                  );
                })}
              </div>

              {/* Zoznam cvikov */}
              <div
                className="overflow-y-auto min-h-0 border-t"
                style={{ borderColor: appColors.surfaceCardBorder }}
              >
                {filtered.map((o) => {
                  const active = o.id === value;
                  const muscles = primaryMuscles(o.id);
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => {
                        close();
                        onValueChange(o.id);
                      }}
                      className="w-full text-left px-3 py-2.5 transition-colors hover:bg-white/5"
                      style={{
                        background: active
                          ? "rgba(255,255,255,0.06)"
                          : undefined,
                      }}
                    >
                      <div className="text-sm truncate">{o.label}</div>
                      {muscles.length > 0 && (
                        <div className="text-[10px] opacity-40 mt-0.5">
                          {muscles.map(muscleLabel).join(" · ")}
                        </div>
                      )}
                    </button>
                  );
                })}
                {filtered.length === 0 && (
                  <div className="px-3 py-4 text-xs opacity-40">
                    {t("strengthLog.noMatch" as any)}
                  </div>
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
