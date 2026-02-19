// src/app/shared/components/widgets/WidgetMonoStrain.tsx
"use client";

import { useMemo } from "react";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { useActivityData } from "@/app/shared/components/dataProviders/ActivityDataProvider";
import { fmtRange } from "@/app/shared/utils/time";

import { appColors } from "@/app/shared/ui/theme/app_colors";
import {
  WIDGET_LOADING_WRAP,
  WIDGET_GRID_2,
  WIDGET_METRIC_LABEL,
  WIDGET_METRIC_VALUE,
  WIDGET_METRIC_NOTE,
  WIDGET_FOOTNOTE,
  WIDGET_EMPTY,
} from "@/app/shared/ui/tokens";
import { useT } from "@/app/shared/i18n/useT";

type Level = "neutral" | "good" | "warn" | "danger";

function levelColor(level: Level): string {
  if (level === "danger") return appColors.stateDanger;
  if (level === "warn") return appColors.stateWarning;
  return "none";
}

function worstLevel(a: Level, b: Level): Level {
  const w: Record<Level, number> = { neutral: 0, good: 1, warn: 2, danger: 3 };
  return w[a] >= w[b] ? a : b;
}

export default function WidgetMonoStrain({
  title,
  onOpenDetail,
}: {
  title?: string;
  onOpenDetail?: () => void;
}) {
  const { rolling7, loading } = useActivityData();
  const t = useT();

  const r7 = rolling7?.("time");
  const mono = useMemo(() => (r7?.last?.mono ?? null) as number | null, [r7]);
  const strain = useMemo(
    () => (r7?.last?.strain ?? null) as number | null,
    [r7],
  );

  const mC = useMemo(() => {
    const v = mono;
    if (v == null || !Number.isFinite(v)) return { label: "—", level: "neutral" as Level };
    if (v < 0.8) return { label: t("monoStrain.levels.mono.low"), level: "good" as Level };
    if (v <= 1.5) return { label: t("monoStrain.levels.mono.ok"), level: "good" as Level };
    if (v <= 2.0) return { label: t("monoStrain.levels.mono.warn"), level: "warn" as Level };
    return { label: t("monoStrain.levels.mono.danger"), level: "danger" as Level };
  }, [mono, t]);

  const sC = useMemo(() => {
    const v = strain;
    if (v == null || !Number.isFinite(v)) return { label: "—", level: "neutral" as Level };
    if (v < 600) return { label: t("monoStrain.levels.strain.low"), level: "good" as Level };
    if (v < 1200) return { label: t("monoStrain.levels.strain.ok"), level: "good" as Level };
    if (v < 1800) return { label: t("monoStrain.levels.strain.warn"), level: "warn" as Level };
    return { label: t("monoStrain.levels.strain.danger"), level: "danger" as Level };
  }, [strain, t]);

  const accentLevel = worstLevel(mC.level, sC.level);
  const accent = levelColor(accentLevel);

  const rangeTxt = r7?.last?.range
    ? fmtRange(r7.last.range.start, r7.last.range.end)
    : "—";

  return (
    <WidgetCard
      title={title ?? t("monoStrain.widget.title")}
      tooltip={t("monoStrain.widget.tooltip")}
      accent={accent}
      onOpen={onOpenDetail}
      interactive={!!onOpenDetail}
      minH={160}
    >
      {loading ? (
        <div className={WIDGET_LOADING_WRAP}>
          <LoadingSpinner size="widget" />
        </div>
      ) : r7?.last ? (
        <>
          <div className={WIDGET_GRID_2}>
            <div>
              <div className={WIDGET_METRIC_LABEL}>{t("monoStrain.monotony")}</div>
              <div className="flex items-baseline gap-2">
                <span className={WIDGET_METRIC_VALUE}>
                  {mono == null ? "—" : mono.toFixed(2)}
                </span>
              </div>
              <div className={WIDGET_METRIC_NOTE}>{mC.label}</div>
            </div>

            <div>
              <div className={WIDGET_METRIC_LABEL}>{t("monoStrain.strain")}</div>
              <div className="flex items-baseline gap-2">
                <span className={WIDGET_METRIC_VALUE}>
                  {strain == null ? "—" : Math.round(strain)}
                </span>
              </div>
              <div className={WIDGET_METRIC_NOTE}>{sC.label}</div>
            </div>
          </div>

          <div className={`${WIDGET_FOOTNOTE} mt-auto pt-2`}>
            {t("common.last7Days")} • {rangeTxt}
          </div>
        </>
      ) : (
        <div className={WIDGET_EMPTY}>
          {t("monoStrain.widget.empty")}
        </div>
      )}
    </WidgetCard>
  );
}