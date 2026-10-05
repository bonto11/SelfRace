"use client";

import { useMemo } from "react";
import { usePerformanceData } from "@/app/shared/components/dataProviders/PerformanceDataProvider";
import TrendCard, { type TrendSpec } from "@/app/shared/charts/TrendCard";
import { dailyPoints, fmtDuration } from "@/app/features/performance/utils/trendPoints";
import { CHART_HR } from "@/app/shared/ui/tokens";
import { useT } from "@/app/shared/i18n/useT";

export default function TrendZonesPaces() {
  const t = useT();
  const { data, loading } = usePerformanceData();

  const points = useMemo(
    () =>
      dailyPoints(data.paceTrends || [], (r: any) => r.measured_at, (r: any) => ({
        z1: r.z1_pace_s,
        z2: r.z2_pace_s,
        z3: r.z3_pace_s,
        z4: r.z4_pace_s,
        z5: r.z5_pace_s,
      })),
    [data.paceTrends],
  );

  const spec = useMemo<TrendSpec>(() => {
    const c = CHART_HR.colors;
    const perKm = `/${t("common.units.km")}`;
    return {
      title: t("zonesPaces.title"),
      subtitle: t("performanceTrends.zonesPaces.subtitle"),
      series: [
        { key: "z2", label: "Z2", color: c.z2 },
        { key: "z1", label: "Z1", color: c.z1 },
        { key: "z3", label: "Z3", color: c.z3 },
        { key: "z4", label: "Z4", color: c.z4 },
        { key: "z5", label: "Z5", color: c.z5 },
      ],
      context: "change",
      fmt: (v) => `${fmtDuration(v)} ${perKm}`,
      fmtStat: fmtDuration,
      fmtDelta: (d) => `${d > 0 ? "+" : "−"}${fmtDuration(d)}`,
      axisFmt: fmtDuration,
      yStep: 15,
      sparse: true,
    };
  }, [t]);

  return <TrendCard spec={spec} points={points} defaultWeeks={12} loading={loading} />;
}
