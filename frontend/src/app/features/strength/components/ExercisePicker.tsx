// src/app/features/strength/components/ExercisePicker.tsx
"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useT } from "@/app/shared/i18n/useT";
import { cx } from "@/app/shared/ui/utils/inputs";
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
  SELECT_MENU,
  SELECT_MENU_EDITABLE,
  SELECT_MENU_EDITABLE_STYLE,
  SELECT_OPT,
  SELECT_OPT_ACTIVE,
  SELECT_OPT_EDITABLE_STYLE,
  SELECT_OPT_EMPTY,
} from "@/app/shared/ui/tokens";

/** Nad modalmi (ManualSessionForm, ExerciseSuggestionModal majú 2147483000). */
const MENU_Z_INDEX = 2147483600;

/** Text na zelenom podklade menu (rovnaký ako v NumberField/TimeField). */
const ON_GREEN = "#111111";

type Props = {
  label?: string;
  value: string;
  onValueChange: (exerciseId: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Skryje štítok s partiami pod výberom (napr. v hustom zozname sérií). */
  hideMuscleHint?: boolean;
};

/**
 * Výber cviku s filtrom podľa svalovej partie. Vzhľad menu je zhodný so
 * SelectFieldFilter (zelené, nepriehľadné). Filter berie aj pomocné partie,
 * takže bench sa nájde aj pod tricepsom.
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
    (id: string) => (STRENGTH_CATALOG_FE as any)[id]?.[lang] ?? id.replace(/_/g, " "),
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
      const GAP = 8;
      const MARGIN = 16;
      const below = window.innerHeight - r.bottom - GAP - MARGIN;
      const above = r.top - GAP - MARGIN;

      // Menu je fixed, takže sa so stránkou neposúva. Keď je tlačidlo nízko
      // (posledný cvik v dlhom formulári), dole ostane pár pixelov a user
      // vidí jediný cvik - vtedy menu otvoríme nahor.
      const openUp = below < 260 && above > below;
      const space = openUp ? above : below;
      const maxHeight = Math.max(200, Math.min(420, space));

      setPos({
        left: r.left,
        top: openUp ? r.top - GAP - maxHeight : r.bottom + GAP,
        width: r.width,
        maxHeight,
      });
    };

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

  const selectedLabel = value ? name(value) : (placeholder ?? t("strengthLog.searchExercise"));
  const selectedMuscles = value && !hideMuscleHint ? primaryMuscles(value) : [];

  const menuStyle = {
    ...SELECT_MENU_EDITABLE_STYLE,
    ...SELECT_OPT_EDITABLE_STYLE,
    ...FORM_TEXT_VARS,
  } as React.CSSProperties;

  return (
    <div className="space-y-1" ref={wrapRef} style={{ ...FIELD_EDITABLE_STYLE, ...FORM_TEXT_VARS }}>
      {label ? <label className={FIELD_LABEL}>{label}</label> : null}

      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={cx(FIELD_EDITABLE_BASE, SELECT_BTN, !value && SELECT_OPT_EMPTY)}
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
              className={cx(SELECT_MENU, SELECT_MENU_EDITABLE, "flex flex-col")}
              role="listbox"
              style={{
                ...menuStyle,
                position: "fixed",
                left: pos.left,
                top: pos.top,
                width: pos.width,
                maxHeight: pos.maxHeight,
                zIndex: MENU_Z_INDEX,
                overflow: "hidden",
              }}
            >
              {/* Hľadanie */}
              <div className="p-1.5 shrink-0">
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
                className="px-1.5 pb-2 shrink-0 flex gap-1.5 overflow-x-auto"
                style={{ WebkitOverflowScrolling: "touch" }}
              >
                {[null, ...MUSCLE_GROUPS].map((m) => {
                  const active = muscle === m;
                  return (
                    <button
                      key={m ?? "all"}
                      type="button"
                      onClick={() => setMuscle(m === null ? null : active ? null : m)}
                      className="shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-colors"
                      style={{
                        background: active ? "#0d1a12" : "transparent",
                        color: active ? "#ffffff" : ON_GREEN,
                        border: `1px solid ${active ? "#0d1a12" : "rgba(0,0,0,0.3)"}`,
                      }}
                    >
                      {m === null ? t("muscleVolume.filterAll" as any) : muscleLabel(m)}
                    </button>
                  );
                })}
              </div>

              {/* Zoznam cvikov */}
              <div
                className="overflow-y-auto min-h-0 border-t"
                style={{ borderColor: "rgba(0,0,0,0.15)" }}
              >
                {filtered.map((o) => {
                  const active = o.id === value;
                  const muscles = primaryMuscles(o.id);
                  return (
                    <button
                      key={o.id}
                      type="button"
                      className={cx(SELECT_OPT, active && SELECT_OPT_ACTIVE)}
                      onClick={() => {
                        close();
                        onValueChange(o.id);
                      }}
                    >
                      <div className="w-full">
                        <div className="truncate">{o.label}</div>
                        {muscles.length > 0 && (
                          <div className="text-[10px] opacity-60 mt-0.5">
                            {muscles.map(muscleLabel).join(" · ")}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
                {filtered.length === 0 && (
                  <div className="px-3 py-4 text-xs opacity-50">
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