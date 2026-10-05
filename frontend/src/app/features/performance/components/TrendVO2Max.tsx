"use client";

import { useMemo } from "react";
import { usePerformanceData } from "@/app/shared/components/dataProviders/PerformanceDataProvider";
import vo2Ref from "@/app/data/VO2Max_Ref_RunnersWorld.json";
import type { Group } from "@/app/features/performance/types/performance";
import TrendCard, { type TrendSpec } from "@/app/shared/charts/TrendCard";
import { colorForVo2RangeLabel } from "@/app/features/performance/utils/performance";
import { dailyPoints, rangesToZones } from "@/app/features/performance/utils/trendPoints";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { useT } from "@/app/shared/i18n/useT";

export default function TrendVO2Max() {
  const t = useT();
  const { data, loading } = usePerformanceData();

  const latest = data.vo2MeasuredLatest || data.vo2EstimatedLatest;
  const sex = latest?.sex || "M";
  const age = latest?.birth_date
    ? Math.floor((Date.now() - new Date(latest.birth_date).getTime()) / (365.25 * 24 * 3600 * 1000))
    : 30;
  const group = (vo2Ref as Group[]).find((g) => g.sex === sex && age >= g.age_min && age <= g.age_max);

  const points = useMemo(() => {
    // odhad aj meranie do jednej mriežky
    const rows = [
      ...(data.vo2EstimatedTrend || []).map((r: any) => ({ d: r.measured_at, est: r.value_num })),
      ...(data.vo2MeasuredTrend || []).map((r: any) => ({ d: r.measured_at, meas: r.value_num })),
    ];
    return dailyPoints(rows, (r) => r.d, (r: any) => ({
      ...(r.est !== undefined ? { est: r.est } : {}),
      ...(r.meas !== undefined ? { meas: r.meas } : {}),
    }));
  }, [data.vo2EstimatedTrend, data.vo2MeasuredTrend]);

  const spec = useMemo<TrendSpec>(() => {
    const unit = t("common.units.vo2max");
    const one = (v: number) => v.toFixed(1);
    return {
      title: t("VO2Max.title"),
      subtitle: t("performanceTrends.vo2.subtitle"),
      series: [
        { key: "est", label: t("VO2Max.chart.estLabel"), color: appColors.chartRecoveryMain },
        { key: "meas", label: t("VO2Max.chart.measLabel"), color: appColors.chartRecoveryAlt, dashed: true },
      ],
      zones: rangesToZones(t, group?.ranges ?? [], colorForVo2RangeLabel),
      context: "zones",
      fmt: (v) => `${one(v)} ${unit}`,
      fmtStat: one,
      fmtDelta: (d) => `${d >= 0 ? "+" : "−"}${one(Math.abs(d))}`,
      axisFmt: (v) => `${Math.round(v)}`,
      yStep: 2,
      sparse: true,
    };
  }, [t, group]);

  return <TrendCard spec={spec} points={points} defaultWeeks={8} loading={loading} emptyText={t("VO2Max.noData")} />;
}
