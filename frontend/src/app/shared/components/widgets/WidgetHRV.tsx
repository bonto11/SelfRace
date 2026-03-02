// src/features/widgets/WidgetHRV.tsx
"use client";

import { useMemo } from "react";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { useT } from "@/app/shared/i18n/useT";

import {
  compareLatestToBaseline,
  makeRollingBaseline,
  checkRecoveryFreshness,
} from "@/app/shared/utils/recovery";
import { useRecoveryData } from "@/app/shared/components/dataProviders/RecoveryDataProvider";

import { appColors } from "@/app/shared/ui/theme/app_colors";
import {
  WIDGET_LOADING_WRAP,
  WIDGET_VALUE_ROW,
  WIDGET_VALUE_PRIMARY,
  WIDGET_VALUE_UNIT,
  WIDGET_NOTE,
} from "@/app/shared/ui/tokens";

function pickAccentFromCmp(
  cmpAccent: unknown,
  opts: { loading: boolean; showNA: boolean },
) {
  if (opts.loading || opts.showNA) return appColors.stateNeutral;

  const a = String(cmpAccent ?? "").toLowerCase();

  if (a.includes("red")) return appColors.stateDanger;
  if (a.includes("amber") || a.includes("yellow")) return appColors.stateWarning;
  if (a.includes("emerald") || a.includes("green")) return "none";

  return "none";
}

export default function WidgetHRV({
  onOpenDetail,
}: {
  onOpenDetail?: () => void;
}) {
  const { rows, loading: loadingRaw } = useRecoveryData() as {
    rows: any[];
    loading?: boolean;
  };
  const loading = !!loadingRaw;
  const t = useT();
  
  const values = useMemo<(number | null)[]>(
    () =>
      rows.map((r) => (typeof r.HRV_avg_ms === "number" ? r.HRV_avg_ms : null)),
    [rows],
  );

  const yesterday = useMemo<number | null>(() => {
    const v = values.at(-1);
    return typeof v === "number" ? v : null;
  }, [values]);

  const baselinePoint = useMemo<number | null>(() => {
    if (values.length < 2) return null;
    const window = values.slice(0, -1);
    const { baseline } = makeRollingBaseline(window, 14, 0.05);
    const last = baseline.at(-1);
    return typeof last === "number" ? last : null;
  }, [values]);

  const cmp = compareLatestToBaseline(
    yesterday,
    baselinePoint,
    "higher-better",
    0.05,
    t
  );

  const freshness = checkRecoveryFreshness(rows, (r) => r.date);
  const showNA = !freshness.hasToday;

  const valueText = showNA
    ? "—"
    : Number.isFinite(yesterday)
      ? String(Math.round(yesterday as number))
      : "—";

  // Vylepšená logika poznámky pre "User Feeling"
  const note = showNA ? t("HRV.widget.noData") : cmp.note;

  const accent = pickAccentFromCmp((cmp as any)?.accent, { loading, showNA });

  return (
    <WidgetCard
      title={t("HRV.widget.title")}
      tooltip={t("HRV.widget.tooltip")}
      accent={accent}
      onOpen={onOpenDetail}
      interactive={!!onOpenDetail}
      minH={160}
    >
      {loading ? (
        <div className={WIDGET_LOADING_WRAP}>
          <LoadingSpinner size="widget" />
        </div>
      ) : (
        <>
          <div className={WIDGET_VALUE_ROW}>
            <span className={WIDGET_VALUE_PRIMARY}>{valueText}</span>
            <span className={WIDGET_VALUE_UNIT}>{t("common.units.ms")}</span>
          </div>
          {note && <p className={WIDGET_NOTE}>{note}</p>}
        </>
      )}
    </WidgetCard>
  );
}