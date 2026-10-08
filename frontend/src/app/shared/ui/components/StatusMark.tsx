"use client";

/*
 * Jedna značka stavu tréningu – rovnaká v dennom widgete, malom aj veľkom
 * kalendári a na karte tréningu:
 *   ○ plan      – naplánované (prázdny krúžok vo farbe športu)
 *   ● activity  – aktivita mimo plánu (plný krúžok)
 *   ✓ done      – splnený plán (spárovaná aktivita)
 *   ✕ missed    – zmeškaný tréning (červený krížik)
 *   ↷ postponed – odložený tréning (sivá šípka)
 * Farba je podľa športu, len zmeškané je vždy červené a odložené sivé –
 * aby boli na prvý pohľad odlíšiteľné aj bez farby športu.
 */

import { Check, CornerUpRight, X } from "lucide-react";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { getSportColor } from "@/app/shared/ui/components/SportBadge";

export type MarkKind = "plan" | "activity" | "done" | "missed" | "postponed";
export type PlanLikeStatus = "planned" | "done" | "missed" | "postponed" | null | undefined;

const SIZE = {
  xs: { box: 10, dot: 6, icon: 10, stroke: 3.5 },
  sm: { box: 14, dot: 8, icon: 13, stroke: 3.5 },
  md: { box: 16, dot: 10, icon: 15, stroke: 3 },
} as const;

export function StatusMark({
  kind,
  sport,
  size = "sm",
  title,
}: {
  kind: MarkKind;
  sport?: string | null;
  size?: keyof typeof SIZE;
  title?: string;
}) {
  const s = SIZE[size];
  const color = getSportColor(String(sport || "other").toLowerCase());
  const box = { width: s.box, height: s.box };

  let inner;
  if (kind === "plan" || kind === "activity") {
    inner = (
      <span
        className="rounded-full"
        style={{
          width: s.dot,
          height: s.dot,
          background: kind === "activity" ? color : "transparent",
          border: kind === "plan" ? `1.5px solid ${color}` : "none",
        }}
      />
    );
  } else if (kind === "done") {
    inner = <Check size={s.icon} color={color} strokeWidth={s.stroke} />;
  } else if (kind === "missed") {
    inner = <X size={s.icon} color={appColors.statusError} strokeWidth={s.stroke} />;
  } else {
    inner = <CornerUpRight size={s.icon} color={appColors.textMuted} strokeWidth={s.stroke - 0.5} />;
  }

  return (
    <span className="inline-flex items-center justify-center shrink-0" style={box} title={title} aria-label={title}>
      {inner}
    </span>
  );
}

/** lokálny dnešný dátum – toISOString by po polnoci posunul deň (UTC) */
export function todayIsoLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Stav plánovanej session → značka. Spárovaná aktivita = splnené aj keď BE
 * status ešte nedobehol; „planned“ v minulosti = zmeškané.
 * Externá aktivita (futbal v stredu) bez spárovanej aktivity ostane krúžkom
 * aj v minulosti – často sa do Stravy nezapisuje, krížik by bol falošný poplach.
 */
export function planMarkKind(opts: {
  status: PlanLikeStatus;
  dateIso: string;
  activityId?: number | null;
  external?: boolean;
  todayIso?: string;
}): MarkKind {
  const today = opts.todayIso ?? todayIsoLocal();
  if (opts.activityId != null || opts.status === "done") return "done";
  if (opts.external) return "plan";
  if (opts.status === "postponed") return "postponed";
  if (opts.status === "missed") return "missed";
  return opts.dateIso < today ? "missed" : "plan";
}
