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
} from "@/app/features/activities/api/strength_sessions";
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
  if (status === "over") return appColors.statusWarning;
  if (status === "under") return appColors.statusWarning;
  return appColors.textMuted;
}

function MuscleRow({ row, label }: { row: MuscleVolumeRow; label: string }) {
  const pct = Math.min(row.pct, 100);
  const color = statusColor(row.status);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm">{label}</span>
        <span className="text-xs font-semibold tabular-nums" style={{ color }}>
          {row.sets_this_week} / {row.target}
        </span>
      </div>
      <div
        className="h-1.5 rounded-full overflow-hidden"
        style={{ background: appColors.surfaceSolid }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

/**
 * 🌟 NOVÉ: koľko sérií na partiu má athlete odcvičených tento týždeň
 * voči cieľu. Cieľ počíta backend z prefs a z behového objemu - pri veľa
 * behu sa cieľ pre nohy automaticky zníži.
 */
export default function MuscleVolumeCard({ weeksBack = 4 }: { weeksBack?: number }) {
  const t = useT();
  const { userId } = useUserId();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<MuscleVolumeOverview | null>(null);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    setLoading(true);
    apiGetMuscleVolume(Number(userId), weeksBack).then((res) => {
      if (!alive) return;
      setData(res);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [userId, weeksBack]);

  const rows = (data?.muscles ?? []).filter(
    (m) => m.sets_this_week > 0 || m.sets_avg_per_week > 0,
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

            {data?.run_volume_tier === "high" && (
              <div className="text-[11px] opacity-60 leading-snug mt-1">
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