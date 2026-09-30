// src/app/features/strength/components/MuscleVolumeCard.tsx
"use client";

import { useEffect, useState } from "react";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { useT } from "@/app/shared/i18n/useT";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { TooltipIcon } from "@/app/shared/ui/components/Tooltip";
import {
  apiGetMuscleVolume,
  type MuscleVolumeOverview,
  type MuscleVolumeRow,
  type MuscleVolumeStatus,
} from "@/app/features/strength/api/strength_sessions";
import {
  PANEL_PAD,
  PANEL_INNER_STACK,
  PANEL_SECTION_HEAD,
  PANEL_SECTION_TITLE,
  PANEL_SECTION_SUBTITLE,
  PANEL_PREVIEW,
  ACCORDION_FOOTER_BAR_MUTED,
} from "@/app/shared/ui/tokens";
import { SESSION_CARD, SESSION_CARD_STYLE } from "@/app/shared/ui/tokens/sessionCard";

function statusColor(status: MuscleVolumeStatus): string {
  if (status === "on_track") return appColors.statusSuccess;
  if (status === "over" || status === "under") return appColors.statusWarning;
  return appColors.textMuted;
}

/** 12 -> "12", 1.5 -> "1.5" (bez zbytočných núl). */
function fmt(v: number): string {
  return String(Number(v.toFixed(1)));
}

function MuscleRow({ row, label }: { row: MuscleVolumeRow; label: string }) {
  const color = statusColor(row.status);
  const donePct = Math.min(row.pct_done, 100);
  const projectedPct = Math.min(row.pct, 100);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm">{label}</span>
        <span className="text-xs font-semibold tabular-nums" style={{ color }}>
          {fmt(row.sets_this_week)}
          {row.sets_planned > 0 ? ` (+${fmt(row.sets_planned)})` : ""} / {row.target}
        </span>
      </div>

      <div
        className="relative h-1.5 rounded-full overflow-hidden"
        style={{ background: appColors.surfaceSolid }}
      >
        {/* naplánované (svetlejšie) */}
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all"
          style={{ width: `${projectedPct}%`, background: color, opacity: 0.35 }}
        />
        {/* zapísané */}
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all"
          style={{ width: `${donePct}%`, background: color }}
        />
      </div>
    </div>
  );
}

/**
 * Objem na partie za tento týždeň: zapísané série + to, čo je ešte
 * naplánované na dnes a ďalšie dni. Cieľ počíta backend z prefs a z
 * behového objemu.
 */
export default function MuscleVolumeCard({ weeksBack = 4 }: { weeksBack?: number }) {
  const t = useT();
  const { userId } = useUserId();

  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [data, setData] = useState<MuscleVolumeOverview | null>(null);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    setLoading(true);
    apiGetMuscleVolume(Number(userId), weeksBack).then((res) => {
      if (!alive) return;
      setData(res);
      setFailed(!res);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [userId, weeksBack]);

  const rows = (data?.muscles ?? []).filter(
    (m) => m.sets_this_week > 0 || m.sets_planned > 0 || m.sets_avg_per_week > 0,
  );

  return (
    <section className={SESSION_CARD} style={SESSION_CARD_STYLE}>
      <header className={[PANEL_PAD, PANEL_SECTION_HEAD].join(" ")}>
        <div className="min-w-0">
          <div className={PANEL_SECTION_TITLE}>
            <span className="inline-flex items-center gap-2">
              {t("muscleVolume.title" as any)}
              <TooltipIcon text={t("muscleVolume.tooltip" as any)} />
            </span>
          </div>
          <div className={PANEL_SECTION_SUBTITLE}>
            {data
              ? (t(`muscleVolume.goals.${data.goal}` as any) as string)
              : t("muscleVolume.subtitle" as any)}
          </div>
        </div>
      </header>

      <div className={[PANEL_PAD, PANEL_INNER_STACK].join(" ")}>
        {loading ? (
          <div className="flex justify-center py-4">
            <LoadingSpinner size="button" />
          </div>
        ) : failed ? (
          <div className={PANEL_PREVIEW}>{t("muscleVolume.error" as any)}</div>
        ) : rows.length === 0 ? (
          <div className={PANEL_PREVIEW}>{t("muscleVolume.empty" as any)}</div>
        ) : (
          <>
            <div className="flex flex-col gap-2.5">
              {rows.map((row) => (
                <MuscleRow
                  key={row.muscle}
                  row={row}
                  label={t(`muscleVolume.muscles.${row.muscle}` as any)}
                />
              ))}
            </div>

            {(data?.total_sets_planned ?? 0) > 0 && (
              <div className="text-[11px] opacity-60 leading-snug mt-1">
                {t("muscleVolume.legend" as any)}
              </div>
            )}

            {data?.run_volume_tier === "high" && (
              <div className="text-[11px] opacity-60 leading-snug">
                {t("muscleVolume.legCapHint" as any)}
              </div>
            )}
          </>
        )}
      </div>
      <div className={ACCORDION_FOOTER_BAR_MUTED} />
    </section>
  );
}