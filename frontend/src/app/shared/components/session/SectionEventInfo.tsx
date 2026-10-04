// src/app/shared/components/session/SectionEventInfo.tsx
"use client";

import { useT } from "@/app/shared/i18n/useT";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import {
  readSessionEvent,
  type ActivityLoad,
} from "@/app/features/coach/api/advisor_daily";

/** Farba podľa náročnosti - rovnaká logika ako pri stave tréningu. */
function loadColor(load: ActivityLoad): string {
  if (load === "hard") return appColors.statusError;
  if (load === "moderate") return appColors.statusWarning;
  return appColors.textSecondary;
}

/**
 * Štítok náročnosti inej aktivity / udalosti. Vykreslí sa v hlavičke
 * karty namiesto stavu tréningu - udalosť sa neplní ani nezmeškáva.
 */
export function EventLoadPill({
  structure,
  isExternal = false,
}: {
  structure: any;
  isExternal?: boolean;
}) {
  const t = useT();
  const ev = readSessionEvent(structure);
  if (!ev) return null;

  const color = loadColor(ev.load);

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap"
      style={{ borderColor: `${color}66`, color, background: "transparent" }}
      title={t(`advisorDaily.form.eventLoadHints.${ev.load}` as any)}
    >
      {isExternal ? "↻ " : ""}
      {t(`advisorDaily.form.eventLoads.${ev.load}` as any)}
    </span>
  );
}

/**
 * Detail inej aktivity / udalosti. Udalosť nemá tréningovú štruktúru,
 * takže namiesto rozcvičky a hlavnej časti ukazuje druh, náročnosť
 * a to, či sa ráta do tréningového objemu.
 */
export default function SectionEventInfo({
  structure,
  isExternal = false,
  timeLocal = null,
  durationMin = null,
}: {
  structure: any;
  isExternal?: boolean;
  timeLocal?: string | null;
  durationMin?: number | null;
}) {
  const t = useT();
  const ev = readSessionEvent(structure);
  if (!ev) return null;

  const color = loadColor(ev.load);
  const when = [
    timeLocal ? String(timeLocal).slice(0, 5) : null,
    typeof durationMin === "number" && durationMin > 0
      ? `${durationMin} ${t("common.units.min")}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="p-4 rounded-xl bg-black/20 border border-white/5 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm">
          {t(`advisorDaily.form.eventKinds.${ev.kind}` as any)}
        </span>
        <span className="text-xs font-semibold" style={{ color }}>
          {t(`advisorDaily.form.eventLoads.${ev.load}` as any)}
        </span>
      </div>

      {when && <div className="text-sm tabular-nums">{when}</div>}

      <div className="text-[11px] opacity-60 leading-relaxed">
        {t(`advisorDaily.form.eventLoadHints.${ev.load}` as any)}
      </div>

      {ev.description && (
        <div className="text-sm text-white/80 leading-relaxed">{ev.description}</div>
      )}

      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] opacity-50 pt-1">
        <span>
          {ev.counts_as_training
            ? t("sessions.detail.event.countsIn")
            : t("sessions.detail.event.countsOut")}
        </span>
        {isExternal && <span>{t("sessions.detail.event.recurring")}</span>}
      </div>
    </div>
  );
}
