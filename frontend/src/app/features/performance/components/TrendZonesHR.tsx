"use client";

import { useMemo } from "react";
import { usePerformanceData } from "@/app/shared/components/dataProviders/PerformanceDataProvider";
import TrendCard, { type TrendSpec } from "@/app/shared/charts/TrendCard";
import { dailyPoints } from "@/app/features/performance/utils/trendPoints";
import { CHART_HR } from "@/app/shared/ui/tokens";
import { useT } from "@/app/shared/i18n/useT";

export default function TrendZonesHR() {
  const t = useT();
  const { data, loading } = usePerformanceData();

  const points = useMemo(
    () =>
      dailyPoints(data.zoneTrends || [], (r: any) => r.created_at, (r: any) => ({
        z1: r.z1_max,
        z2: r.z2_max,
        z3: r.z3_max,
        z4: r.z4_max,
        z5: r.z5_min, // spodná hranica Z5
      })),
    [data.zoneTrends],
  );

  const spec = useMemo<TrendSpec>(() => {
    const c = CHART_HR.colors;
    const unit = t("common.units.hr");
    return {
      title: t("zonesHR.title"),
      subtitle: t("performanceTrends.zonesHR.subtitle"),
      // Z2 je hlavná – základ vytrvalostného tréningu
      series: [
        { key: "z2", label: "Z2", color: c.z2 },
        { key: "z1", label: "Z1", color: c.z1 },
        { key: "z3", label: "Z3", color: c.z3 },
        { key: "z4", label: "Z4", color: c.z4 },
        { key: "z5", label: "Z5", color: c.z5 },
      ],
      context: "change",
      fmt: (v) => `${Math.round(v)} ${unit}`,
      fmtStat: (v) => `${Math.round(v)}`,
      fmtDelta: (d) => `${d >= 0 ? "+" : "−"}${Math.abs(Math.round(d))}`,
      axisFmt: (v) => `${Math.round(v)}`,
      yStep: 10,
      sparse: true,
    };
  }, [t]);

  return <TrendCard spec={spec} points={points} defaultWeeks={12} loading={loading} />;
}
