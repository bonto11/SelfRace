// src/features/recovery/components/DetailSleepDuration.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Line } from "react-chartjs-2";
import type { ChartData, ChartOptions } from "chart.js";
import { ensureChartJSRegistered } from "@/shared/charts/register";
import { THEME } from "@/shared/theme/tokens";
import { minutesToHHMM, wrapToLines } from "@/shared/utils/recovery";
import { buildRecoveryLineOptions } from "@/shared/charts/optionsRecovery";
import { useRecoveryData } from "@/shared/components/dataProviders/RecoveryDataProvider";
import LoadingSpinner from "@/shared/components/ui/LoadingSpinner";
import { CARD, SCROLL_X } from "@/shared/ui/classes";
import { inputClass } from "@/shared/ui";

ensureChartJSRegistered();

export default function DetailSleepDuration() {
  const { rows: all } = useRecoveryData();
  const [weeks, setWeeks] = useState<number>(2);
  const [loading, setLoading] = useState<boolean>(false);

  const DAY_PX_PER_LABEL = 26;

  useEffect(() => { setLoading(true); }, [weeks]);

  const days = weeks * 7;
  const rows = useMemo(() => (days > 0 ? all.slice(-days) : all), [all, days]);

  useEffect(() => {
    const t = requestAnimationFrame(() => setLoading(false));
    return () => cancelAnimationFrame(t);
  }, [rows]);

  const labelsISO = useMemo(() => rows.map((r) => r.date), [rows]);
  const sleepMin = useMemo(
    () => rows.map((r) => (typeof r.sleep_duration_min === "number" ? r.sleep_duration_min : NaN)),
    [rows]
  );

  const lowerBand = useMemo(() => rows.map(() => 420), [rows]); // 7h
  const upperBand = useMemo(() => rows.map(() => 540), [rows]); // 9h

  const comments = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) if (r.comments) m.set(r.date, r.comments);
    return m;
  }, [rows]);

  const data: ChartData<"line", number[], string> = useMemo(() => ({
    labels: labelsISO,
    datasets: [
      { type: "line", label: "7–9h (spodná)", data: lowerBand, borderColor: "rgba(16,185,129,0)", backgroundColor: "rgba(16,185,129,0.15)", pointRadius: 0, borderWidth: 0, tension: 0.2, order: 1 },
      { type: "line", label: "7–9h (horná)",  data: upperBand, borderColor: "rgba(16,185,129,0)", backgroundColor: "rgba(16,185,129,0.15)", pointRadius: 0, borderWidth: 0, tension: 0.2, fill: "-1", order: 1 },
      { type: "line", label: "Sleep duration", data: sleepMin, borderColor: "#8b5cf6", backgroundColor: "#8b5cf6", pointRadius: 3, borderWidth: 2, tension: 0.2, spanGaps: true, order: 2 },
    ],
  }), [labelsISO, lowerBand, upperBand, sleepMin]);

  const options: ChartOptions<"line"> = useMemo(
    () =>
      buildRecoveryLineOptions({
        labelsISO,
        yTitle: "min",
        yTickFormatter: (v: number) => minutesToHHMM(v),
        tooltipTitleForIndex: (i) => new Date((labelsISO[i] ?? "") + "T00:00:00").toLocaleDateString("sk-SK"),
        tooltipLabelForItem: (ctx): string => {
          const idx = ctx.dataIndex ?? 0;
          const lines: string[] = [];
          if (ctx.datasetIndex === 2) {
            const v = sleepMin[idx];
            if (Number.isFinite(v)) lines.push(`Spánok: ${minutesToHHMM(v as number)}`);
            const c = comments.get(labelsISO[idx] ?? "");
            if (c) lines.push(...wrapToLines(c, 44));
          }
          return lines.length ? lines.join("\n") : `${ctx.dataset?.label ?? ""}: ${ctx.formattedValue ?? ""}`;
        },
        tooltipFilter: (item) => item.datasetIndex === 2,
      }),
    [labelsISO, sleepMin, comments]
  );

  const minWidth = Math.max(360, Math.round(labelsISO.length * DAY_PX_PER_LABEL));

  return (
    <div className={`${CARD} relative`}>
      <div className="px-4 pt-4 pb-2 flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold">Sleep Duration</h2>
        <select value={weeks} onChange={(e) => setWeeks(Number(e.target.value))} className={`${inputClass} h-8 text-xs w-[132px]`}>
          <option value={2}>2 týždne</option>
          <option value={4}>4 týždne</option>
          <option value={8}>8 týždňov</option>
          <option value={12}>12 týždňov</option>
        </select>
      </div>

      <div className={`${SCROLL_X} min-w-0`} style={{ WebkitOverflowScrolling: "touch", contain: "inline-size" }}>
        <div className="relative" style={{ height: THEME.chart.weeklyHeight }}>
          {loading && <div className="absolute inset-0 grid place-items-center z-10 bg-black/10"><LoadingSpinner size="trend" /></div>}
          <div style={{ minWidth, height: "100%", maxWidth: "none" }}>
            <Line data={data} options={options} />
          </div>
        </div>
      </div>
    </div>
  );
}