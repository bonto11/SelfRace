"use client";

import { useMemo, useState } from "react";
import { usePerformanceData } from "@/app/shared/components/dataProviders/PerformanceDataProvider";
import TrendCard, { type TrendSpec } from "@/app/shared/charts/TrendCard";
import SegmentedControl from "@/app/shared/ui/components/SegmentedControl";
import { dailyPoints, fmtDuration, fmtDurationAxis } from "@/app/features/performance/utils/trendPoints";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { useT } from "@/app/shared/i18n/useT";

/*
 * PREČO jedna vzdialenosť naraz: 5 km (~20 min) a maratón (~3 h) na jednej
 * osi stlačili všetky čiary do rovných – zmena o pár sekúnd nebola vidieť.
 */
const DISTANCES = [
  { id: "5", field: "est_5k_time_s", km: "5", step: 30 },
  { id: "10", field: "est_10k_time_s", km: "10", step: 60 },
  { id: "21", field: "est_half_marathon_time_s", km: "21,1", step: 120 },
  { id: "42", field: "est_marathon_time_s", km: "42,2", step: 300 },
] as const;
type DistId = (typeof DISTANCES)[number]["id"];

export default function TrendEstTopPaces() {
  const t = useT();
  const { data, loading } = usePerformanceData();
  const [dist, setDist] = useState<DistId>("10");
  const d = DISTANCES.find((x) => x.id === dist)!;
  const km = t("common.units.km");

  const points = useMemo(
    () => dailyPoints(data.paceTrends || [], (r: any) => r.measured_at, (r: any) => ({ val: r[d.field] })),
    [data.paceTrends, d.field],
  );

  const spec = useMemo<TrendSpec>(
    () => ({
      title: t("estTopPaces.widget.title"),
      subtitle: t("performanceTrends.paces.subtitle"),
      series: [{ key: "val", label: `${d.km} ${km}`, color: appColors.chartRecoveryMain }],
      // kratší čas = lepší; rozdiel ukazujeme so znamienkom, bez hodnotenia
      context: "change",
      fmt: fmtDuration,
      fmtStat: fmtDuration,
      fmtDelta: (x) => `${x > 0 ? "+" : "−"}${fmtDuration(x)}`,
      axisFmt: fmtDurationAxis,
      yStep: d.step,
      sparse: true,
    }),
    [t, d, km],
  );

  return (
    <TrendCard
      spec={spec}
      points={points}
      defaultWeeks={12}
      loading={loading}
      extraControls={
        <SegmentedControl
          options={DISTANCES.map((x) => ({ value: x.id, label: `${x.km} ${km}` }))}
          value={dist}
          onChange={setDist}
        />
      }
    />
  );
}
