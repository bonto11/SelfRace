"use client";

import { useState } from "react";

/** Jednoduchý badge pre šport – rovnaký look ako v PlanCards */
function SportBadge({ kind }: { kind: string }) {
  const label =
    kind === "run" ? "Run" :
    kind === "ride" ? "Ride" :
    kind === "strength" ? "Strength" : "Mixed";
  return (
    <span className="text-xs px-2 py-0.5 rounded bg-gray-700">
      {label}
    </span>
  );
}

export type SessionCardProps = {
  id?: string;
  /** Ľavá časť headeru – typicky „Mon · 04.11.2025“ alebo názov dňa */
  headerLeft: React.ReactNode;
  /** run | ride | strength | mixed | other – renderuje sa ako badge vpravo */
  sportKind?: "run" | "ride" | "strength" | "mixed" | "other" | string;
  /** Hlavný titul (napr. názov aktivity alebo tréningu) */
  title: React.ReactNode;
  /** Sekundárny text pod titulom (napr. focus/účel) – ak je prázdny, ukáže „—“ slabou farbou */
  subtitle?: string | null;
  /** Meta riadok – pole stringov, zobrazí sa „ · “ join (napr. Time 45:00 · Distance 10.0 km · HR 150) */
  meta?: (string | null | undefined)[];
  /** Obsah, ktorý sa rozbalí pod kartou (detail aktivity / detail tréningu) */
  children?: React.ReactNode;

  /** Ovládaný mód: otvorenosť zvonka */
  open?: boolean;
  /** Callback pri zmene – ak dáš `open`, budeš v controlled móde */
  onOpenChange?: (open: boolean) => void;
  /** Počiatočný stav pre neovládaný mód */
  defaultOpen?: boolean;

  /** Disable expand When no children (napr. prázdny deň) */
  disableToggleIfNoChildren?: boolean;
};

export default function CommonActivityCard({
  id,
  headerLeft,
  sportKind = "other",
  title,
  subtitle,
  meta,
  children,
  open,
  onOpenChange,
  defaultOpen = false,
  disableToggleIfNoChildren = false,
}: SessionCardProps) {
  const isControlled = typeof open === "boolean";
  const [internal, setInternal] = useState<boolean>(defaultOpen);
  const opened = isControlled ? (open as boolean) : internal;

  const canToggle = !disableToggleIfNoChildren || !!children;

  const toggle = () => {
    if (!canToggle) return;
    const next = !opened;
    if (isControlled) onOpenChange?.(next);
    else setInternal(next);
  };

  const metaLine = (meta ?? []).filter(Boolean).join(" · ");

  return (
    <section
      id={id}
      className={[
        "rounded-2xl shadow-lg border border-white/10",
        "bg-white/90 dark:bg-gray-900/70 backdrop-blur",
        "px-4 py-3",
      ].join(" ")}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium truncate">{headerLeft}</div>

        <div className="flex items-center gap-2">
          <SportBadge kind={sportKind} />
          <button
            type="button"
            aria-expanded={opened}
            onClick={toggle}
            disabled={!canToggle}
            title={opened ? "Skryť detail" : "Otvoriť detail"}
            className={[
              "h-8 w-8 grid place-items-center rounded-full border border-white/10",
              canToggle
                ? "bg-white/10 hover:bg-white/20 transition-colors"
                : "opacity-40 cursor-not-allowed",
            ].join(" ")}
          >
            <span
              className={[
                "text-base leading-none select-none transition-transform",
                opened ? "rotate-180" : "rotate-0",
              ].join(" ")}
            >
              ▾
            </span>
          </button>
        </div>
      </div>

      {/* Title */}
      <div className="mt-0.5 text-base font-semibold tracking-tight truncate">
        {title}
      </div>

      {/* Subtitle */}
      <div className={subtitle ? "text-xs opacity-80" : "text-xs opacity-40"}>
        {subtitle || "—"}
      </div>

      {/* Meta */}
      {metaLine && (
        <div className="text-xs mt-1 opacity-80">{metaLine}</div>
      )}

      {/* Detail */}
      {opened && children ? (
        <div className="mt-2">
          {children}
        </div>
      ) : null}
    </section>
  );
}