// src/features/recovery/components/TrendHRV.tsx
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
import { CARD, PAD, SCROLL_X, inputClass } from "@/shared/ui/classes";

ensureChartJSRegistered();

export default function TrendHRV() {
  const { rows: all } = useRecoveryData();
  const [weeks, setWeeks] = useState<number>(2);
  const [loading, setLoading] = useState<boolean>(false);

  // ❗ Použi centrálne px/label; keď chcem menšie, uberiem 20 %
  const PX_PER_LABEL = Math.round((THEME.chart?.pxPerLabel ?? 26) * 0.8); // 20 → ~21
  // ❗ Polovičný min-guard (bol 360) – teraz 180
  const MIN_CANVAS_W = 180;

  useEffect(() => { setLoading(true); }, [weeks]);

  const days = weeks * 7;
  const rows = useMemo(() => (days > 0 ? all.slice(-days) : all), [all, days]);

  useEffect(() => {
    const t = requestAnimationFrame(() => setLoading(false));
    return () => cancelAnimationFrame(t);
  }, [rows]);

  const labelsISO = useMemo(() => rows.map((r) => r.date), [rows]);
  const hrv = useMemo(
    () => rows.map((r) => (typeof r.HRV_avg_ms === "number" ? (r.HRV_avg_ms as number) : NaN)),
    [rows]
  );
  const baselineArr = useMemo(
    () => rollingMean(rows.map((r) => (typeof r.HRV_avg_ms === "number" ? (r.HRV_avg_ms as number) : null)), 14),
    [rows]
  );
  const { lower, upper } = useMemo(() => bandsAround(baselineArr, 0.05), [baselineArr]);

  const comments = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) if (r.comments) m.set(r.date, r.comments);
    return m;
  }, [rows]);

  const data: ChartData<"line", number[], string> = useMemo(() => {
    const toNum = (xs: (number | null)[]) => xs.map((v) => (typeof v === "number" ? v : NaN));
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
      // ❗ úplne minimálne okraje grafu – nech je „flush“
      layout: { padding: { left: 4, right: 6, top: 6, bottom: 10 } },
      plugins: {
        ...base.plugins,
        legend: {
          ...(base.plugins?.legend ?? {}),
          position: "top",
          align: "start",
          labels: {
            ...(base.plugins?.legend?.labels ?? {}),
            padding: 8,
            usePointStyle: true,
            pointStyle: "circle",
            boxWidth: 6,
            boxHeight: 6,
          },
        },
      },
    };
  }, [labelsISO, hrv, baselineArr, comments]);

  // ❗ menšia min-width + menší krok na deň
  const minWidth = Math.max(MIN_CANVAS_W, Math.round(labelsISO.length * PX_PER_LABEL));

  return (
    <div className={`${CARD} relative min-w-0 text-left`}>
      {/* HEADER – výhradne z PAD.head, žiadne lokálne px-4/pt-4 */}
      <div className={`${PAD.head} flex flex-wrap items-start gap-2`}>
        <h2 className="text-lg font-bold mr-2">Detail — HRV (RMSSD)</h2>
        <select
          value={weeks}
          onChange={(e) => setWeeks(Number(e.target.value))}
          // ❗ fix šírka menšia, shrink-0 aby netlačilo layout
          className={`${inputClass} h-8 text-xs w-[96px] sm:w-[112px] md:w-[128px] shrink-0 self-start`}
        >
          <option value={2}>2 týždne</option>
          <option value={4}>4 týždne</option>
          <option value={8}>8 týždňov</option>
          <option value={12}>12 týždňov</option>
        </select>
      </div>

      {/* BODY – flush + horizontálny scroll */}
      <div className={`${SCROLL_X} min-w-0`} style={{ WebkitOverflowScrolling: "touch", contain: "inline-size" }}>
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

      {/* FOOTER – jemný padding z PAD.foot (ak chceš) */}
      {/* <div className={`${PAD.foot} text-xs opacity-80`}>Tip: rozsah je rolovateľný.</div> */}
    </div>
  );
}