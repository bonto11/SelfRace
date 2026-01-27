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

type Level = "neutral" | "good" | "warn" | "danger";

const C = appColors as any;

function levelColor(level: Level): string {
  if (level === "danger") return appColors.stateDanger;
  else if (level === "warn") return appColors.stateWarning;
  else if (level === "good") return "";
  else return "";
}

// ...zvyšok bez zmeny

function worstLevel(a: Level, b: Level): Level {
  const w: Record<Level, number> = { neutral: 0, good: 1, warn: 2, danger: 3 };
  return w[a] >= w[b] ? a : b;
}

function classifyMonotony(v?: number | null): { label: string; level: Level } {
  if (v == null || !Number.isFinite(v)) return { label: "—", level: "neutral" };
  if (v < 0.8) return { label: "nízka variabilita (OK)", level: "good" };
  if (v <= 1.5) return { label: "vyvážené (OK)", level: "good" };
  if (v <= 2.0) return { label: "vyššia monotónnosť", level: "warn" };
  return { label: "riziko preťaženia", level: "danger" };
}

function classifyStrain(v?: number | null): { label: string; level: Level } {
  if (v == null || !Number.isFinite(v)) return { label: "—", level: "neutral" };
  if (v < 600) return { label: "ľahší týždeň", level: "good" };
  if (v < 1200) return { label: "stredný load", level: "good" };
  if (v < 1800) return { label: "vyšší load", level: "warn" };
  return { label: "veľmi vysoký", level: "danger" };
}

export default function WidgetMonoStrain({
  title = "Indexy záťaže",
  onOpenDetail,
}: {
  title?: string;
  onOpenDetail?: () => void;
}) {
  const { rolling7, loading } = useActivityData();

  const r7 = rolling7?.("time");
  const mono = useMemo(() => (r7?.last?.mono ?? null) as number | null, [r7]);
  const strain = useMemo(
    () => (r7?.last?.strain ?? null) as number | null,
    [r7],
  );

  const mC = classifyMonotony(mono);
  const sC = classifyStrain(strain);

  const accentLevel = worstLevel(mC.level, sC.level);
  const accent = levelColor(accentLevel);

  const rangeTxt = r7?.last?.range
    ? fmtRange(r7.last.range.start, r7.last.range.end)
    : "—";

  return (
    <WidgetCard
      title={title}
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
              <div className={WIDGET_METRIC_LABEL}>Monotony</div>
              <div className="flex items-baseline gap-2">
                <span className={WIDGET_METRIC_VALUE}>
                  {mono == null ? "—" : mono.toFixed(2)}
                </span>
              </div>
              <div className={WIDGET_METRIC_NOTE}>{mC.label}</div>
            </div>

            <div>
              <div className={WIDGET_METRIC_LABEL}>Strain</div>
              <div className="flex items-baseline gap-2">
                <span className={WIDGET_METRIC_VALUE}>
                  {strain == null ? "—" : Math.round(strain)}
                </span>
              </div>
              <div className={WIDGET_METRIC_NOTE}>{sC.label}</div>
            </div>
          </div>

          <div className={WIDGET_FOOTNOTE}>Posledných 7 dní • {rangeTxt}</div>
        </>
      ) : (
        <div className={WIDGET_EMPTY}>
          Dáta pre posledných 7 dní nie sú k dispozícii.
        </div>
      )}
    </WidgetCard>
  );
}
