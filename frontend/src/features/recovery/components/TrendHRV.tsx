// src/features/recovery/components/DetailHRV.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Line } from "react-chartjs-2";
import type { ChartData, ChartOptions } from "chart.js";
import { ensureChartJSRegistered } from "@/shared/charts/register";
import { THEME } from "@/shared/theme/tokens";
import { rollingMean, bandsAround, wrapToLines } from "@/shared/utils/recovery";
import { buildRecoveryLineOptions } from "@/shared/charts/optionsRecovery";
import { useRecoveryData } from "@/shared/components/dataProviders/RecoveryDataProvider";
import LoadingSpinner from "@/shared/components/ui/LoadingSpinner";
import { CARD } from "@/shared/ui/classes";
import { inputClass } from "@/shared/ui";

ensureChartJSRegistered();

export default function DetailHRV() {
  const { rows: all } = useRecoveryData();
  const [weeks, setWeeks] = useState<number>(2);
  const [loading, setLoading] = useState(false);

  useEffect(() => { setLoading(true); }, [weeks]);

  const days = weeks * 7;
  const rows = useMemo(() => (days > 0 ? all.slice(-days) : all), [all, days]);

  useEffect(() => {
    const t = requestAnimationFrame(() => setLoading(false));
    return () => cancelAnimationFrame(t);
  }, [rows]);

  const labelsISO = useMemo(() => rows.map(r => r.date), [rows]);
  const hrv = useMemo(() => rows.map(r => (typeof r.HRV_avg_ms === "number" ? r.HRV_avg_ms as number : NaN)), [rows]);

  const baselineArr = useMemo(
    () => rollingMean(rows.map(r => (typeof r.HRV_avg_ms === "number" ? r.HRV_avg_ms as number : null)), 14),
    [rows]
  );
  const { lower, upper } = useMemo(() => bandsAround(baselineArr, 0.05), [baselineArr]);

  const comments = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) if (r.comments) m.set(r.date, r.comments);
    return m;
  }, [rows]);

  const data: ChartData<"line", number[], string> = useMemo(() => {
    const toNum = (xs: (number | null)[]) => xs.map(v => (typeof v === "number" ? v : NaN));
    return {
      labels: labelsISO,
      datasets: [
        {
          type: "line",
          label: "Baseline −5%",
          data: toNum(lower),
          borderColor: "rgba(16,185,129,0)",
          backgroundColor: "rgba(16,185,129,0.15)",
          pointRadius: 0,
          borderWidth: 0,
          tension: 0.2,
          order: 1,
        },
        {
          type: "line",
          label: "Baseline +5%",
          data: toNum(upper),
          borderColor: "rgba(16,185,129,0)",
          backgroundColor: "rgba(16,185,129,0.15)",
          pointRadius: 0,
          borderWidth: 0,
          tension: 0.2,
          fill: "-1",
          order: 1,
        },
        {
          type: "line",
          label: "Baseline (14d priemer)",
          data: toNum(baselineArr),
          borderColor: "#22c55e",
          backgroundColor: "#22c55e",
          pointRadius: 0,
          borderWidth: 2,
          tension: 0.25,
          spanGaps: true,
          order: 2,
        },
        {
          type: "line",
          label: "HRV (RMSSD)",
          data: hrv,
          borderColor: "#0ea5e9",
          backgroundColor: "#0ea5e9",
          pointRadius: 3,
          borderWidth: 2,
          tension: 0.2,
          spanGaps: true,
          order: 3,
        },
      ],
    };
  }, [labelsISO, lower, upper, baselineArr, hrv]);

  // vezmeme base options a doplníme kompaktné rozloženie osí/legendy
  const options: ChartOptions<"line"> = useMemo(() => {
    const base = buildRecoveryLineOptions({
      labelsISO,
      yTitle: "ms",
      tooltipTitleForIndex: (i) => {
        const iso = labelsISO[i] ?? "";
        return new Date(iso + "T00:00:00").toLocaleDateString("sk-SK");
      },
      tooltipLabelForItem: (ctx): string | string[] => {
        const idx = ctx.dataIndex ?? 0;
        const lines: string[] = [];
        if (ctx.datasetIndex === 3) {
          const v = hrv[idx];
          if (Number.isFinite(v)) lines.push(`HRV: ${Math.round(v as number)} ms`);
          const c = comments.get(labelsISO[idx] ?? "");
          if (c) lines.push(...wrapToLines(c, 44));
        }
        if (ctx.datasetIndex === 2) {
          const b = baselineArr[idx];
          if (Number.isFinite(b as number)) lines.push(`Baseline: ${Math.round(b as number)} ms`);
        }
        return lines.length ? lines : `${ctx.dataset?.label ?? ""}: ${ctx.formattedValue ?? ""}`;
      },
      tooltipFilter: (item) => item.datasetIndex === 2 || item.datasetIndex === 3,
    });

    return {
      ...base,
      maintainAspectRatio: false,
      layout: { padding: { top: 0, right: 0, bottom: 0, left: 0 } },
      plugins: {
        ...base.plugins,
        legend: {
          position: THEME.chart.legendPosition,
          labels: { usePointStyle: true, pointStyle: "circle", padding: 8, boxWidth: 6, boxHeight: 6, font: { size: 11 } },
        },
      },
      scales: {
        ...base.scales,
        x: {
          ...base.scales?.x,
          ticks: { ...(base.scales as any)?.x?.ticks, maxRotation: 0, minRotation: 0, padding: 4, font: { size: 10 } },
          grid: { color: THEME.chart.gridSoft },
        },
        y: {
          ...base.scales?.y,
          grid: { color: THEME.chart.grid },
        },
      },
    };
  }, [labelsISO, hrv, baselineArr, comments]);

  const minWidth = Math.max(320, Math.round(labelsISO.length * (THEME.chart?.pxPerLabel ?? 26)));

  return (
    <div className={`${CARD} relative`}>
      {/* HEADER s paddingom */}
      <div className="px-3 pt-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Detail — HRV (RMSSD)</h2>
          <select
            value={weeks}
            onChange={(e) => setWeeks(Number(e.target.value))}
            className={`${inputClass} h-8 text-xs w-[140px]`}
          >
            <option value={2}>2 týždne</option>
            <option value={4}>4 týždne</option>
            <option value={8}>8 týždňov</option>
            <option value={12}>12 týždňov</option>
          </select>
        </div>
        <div className="mt-3 border-t border-white/10" />
      </div>

      {/* CHART bez paddingov + horizontálny scroll */}
      <div
        className="overflow-x-auto overflow-y-hidden rounded-b-xl min-w-0"
        style={{ WebkitOverflowScrolling: "touch", contain: "inline-size" }}
      >
        <div className="relative" style={{ height: THEME.chart.weeklyHeight }}>
          {loading && (
            <div className="absolute inset-0 grid place-items-center z-10 bg-black/10">
              <LoadingSpinner size="trend" />
            </div>
          )}
          <div style={{ minWidth, height: "100%", maxWidth: "none" }}>
            <Line data={data} options={options} />
          </div>
        </div>
      </div>
    </div>
  );
}