// src/app/features/performance/components/TrendBodyFat.tsx
"use client";

import { useMemo } from "react";
import { usePerformanceData } from "@/app/shared/components/dataProviders/PerformanceDataProvider";
import { getBodyFatBands } from "@/app/shared/utils/bands";
import TrendCard, { type TrendSpec } from "@/app/shared/charts/TrendCard";
import { colorForBodyFatBand } from "@/app/features/performance/utils/performance";
import { dailyPoints, rangesToZones } from "@/app/features/performance/utils/trendPoints";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { useT } from "@/app/shared/i18n/useT";

export default function TrendBodyFat() {
  const t = useT();
  const { data, loading } = usePerformanceData();
  const sex = (data.bodyFatLatest?.sex || "M") as "M" | "F";

  const points = useMemo(
    () => dailyPoints(data.bodyFatTrend || [], (r: any) => r.measured_at, (r: any) => ({ val: r.value_num })),
    [data.bodyFatTrend],
  );

  const spec = useMemo<TrendSpec>(() => {
    const one = (v: number) => v.toFixed(1);
    return {
      title: t("bodyFat.chartLabel"),
      subtitle: t("performanceTrends.bodyFat.subtitle"),
      series: [{ key: "val", label: t("bodyFat.chartLabel"), color: appColors.chartRecoveryMain }],
      zones: rangesToZones(t, getBodyFatBands(sex) as any, colorForBodyFatBand),
      context: "zones",
      fmt: (v) => `${one(v)} %`,
      fmtStat: one,
      fmtDelta: (d) => `${d >= 0 ? "+" : "−"}${one(Math.abs(d))} %`,
      axisFmt: (v) => `${Math.round(v)}`,
      yStep: 2,
      sparse: true,
    };
  }, [t, sex]);

  return <TrendCard spec={spec} points={points} defaultWeeks={8} loading={loading} emptyText={t("bodyFat.noData")} />;
}
