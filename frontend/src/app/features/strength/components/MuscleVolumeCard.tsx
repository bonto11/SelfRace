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
import MuscleVolumeBar, {
  TICK_MAINTAIN,
  TICK_DEVELOP,
  TICK_TARGET,
  fmtSets,
  volumeColor,
} from "@/app/features/strength/components/MuscleVolumeBar";


type Bands = MuscleVolumeOverview["bands"];

/** Popisky mierky: 0, 5, 10, 15, 20 (podľa scaleMax). */
function scaleTicks(scaleMax: number): number[] {
  const out: number[] = [];
  for (let v = 0; v <= scaleMax; v += 5) out.push(v);
  return out;
}

function MuscleRow({
  row,
  label,
  bands,
  scaleMax,
}: {
  row: MuscleVolumeRow;
  label: string;
  bands: MuscleVolumeOverview["bands"];
  scaleMax: number;
}) {
  const color = volumeColor(row.sets_projected, row.target);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm">{label}</span>
        <span className="text-xs font-semibold tabular-nums" style={{ color }}>
          {fmtSets(row.sets_this_week)}
          {row.sets_planned > 0 ? ` (+${fmtSets(row.sets_planned)})` : ""} / {row.target}
        </span>
      </div>
      <MuscleVolumeBar
        done={row.sets_this_week}
        added={row.sets_planned}
        target={row.target}
        bands={bands}
        scaleMax={scaleMax}
        addedKind="planned"
      />
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block rounded-sm"
        style={{ width: 4, height: 12, background: color }}
      />
      <span>{label}</span>
    </span>
  );
}

/**
 * Objem na partie za tento týždeň: zapísané série + to, čo je ešte
 * naplánované. Mierka je spoločná pre všetky partie, cieľ je individuálny
 * (biela ryska) - pri malých partiách je nižšie než pri veľkých.
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
  const scaleMax = data?.scale_max || 22;

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
        ) : rows.length === 0 || !data ? (
          <div className={PANEL_PREVIEW}>{t("muscleVolume.empty" as any)}</div>
        ) : (
          <>
            {/* Mierka: len čísla. Jednotka má vlastný riadok, aby sa
                neprekrývala s posledným popiskom. */}
            <div className="text-[10px] opacity-40 mb-0.5">
              {t("muscleVolume.scaleUnit" as any)}
            </div>
            <div className="relative h-3 text-[10px] opacity-40 tabular-nums mb-1">
              {scaleTicks(scaleMax).map((v) => (
                <span
                  key={v}
                  className="absolute -translate-x-1/2"
                  style={{ left: `${(v / scaleMax) * 100}%` }}
                >
                  {v}
                </span>
              ))}
            </div>

            <div className="flex flex-col gap-2.5">
              {rows.map((row) => (
                <MuscleRow
                  key={row.muscle}
                  row={row}
                  label={t(`muscleVolume.muscles.${row.muscle}` as any)}
                  bands={data.bands}
                  scaleMax={scaleMax}
                />
              ))}
            </div>

            {/* Legenda k zvislým ryskám */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] opacity-70 mt-1.5">
              <LegendDot
                color={TICK_MAINTAIN}
                label={`${t("muscleVolume.bandMaintain" as any)} (${data.bands.maintenance_min}+)`}
              />
              <LegendDot
                color={TICK_DEVELOP}
                label={`${t("muscleVolume.bandDevelop" as any)} (${data.bands.development_min}+)`}
              />
              <LegendDot color={TICK_TARGET} label={t("muscleVolume.bandTarget" as any)} />
            </div>

            {data.total_sets_planned > 0 && (
              <div className="text-[11px] opacity-60 leading-snug">
                {t("muscleVolume.legend" as any)}
              </div>
            )}

            {data.run_volume_tier === "high" && (
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