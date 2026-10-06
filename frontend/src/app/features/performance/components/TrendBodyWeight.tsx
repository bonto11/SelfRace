// src/app/features/performance/components/TrendBodyWeight.tsx
"use client";

import { useMemo } from "react";
import { usePerformanceData } from "@/app/shared/components/dataProviders/PerformanceDataProvider";
import TrendCard, { type TrendSpec } from "@/app/shared/charts/TrendCard";
import { dailyPoints } from "@/app/features/performance/utils/trendPoints";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { useT } from "@/app/shared/i18n/useT";

export default function TrendBodyWeight() {
  const t = useT();
  const { data, loading } = usePerformanceData();

  const points = useMemo(
    () => dailyPoints(data.bodyWeightTrend || [], (r: any) => r.measured_at, (r: any) => ({ val: r.value_num })),
    [data.bodyWeightTrend],
  );

  const spec = useMemo<TrendSpec>(() => {
    const kg = t("common.units.kg");
    const one = (v: number) => v.toFixed(1);
    return {
      title: t("performance.metrics.weightLabel"),
      subtitle: t("performanceTrends.weight.subtitle"),
      series: [{ key: "val", label: t("performance.metrics.weightLabel"), color: appColors.chartRecoveryMain }],
      context: "change",
      fmt: (v) => `${one(v)} ${kg}`,
      fmtStat: one,
      fmtDelta: (d) => `${d >= 0 ? "+" : "−"}${one(Math.abs(d))} ${kg}`,
      axisFmt: (v) => `${Math.round(v)}`,
      yStep: 1,
      sparse: true,
    };
  }, [t]);

  return <TrendCard spec={spec} points={points} defaultWeeks={8} loading={loading} />;
}
