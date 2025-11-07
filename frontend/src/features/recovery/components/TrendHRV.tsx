// src/features/recovery/components/TrendHRV.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

/** Zmeraj šírku wrapperu (bez knižníc) */
function useContainerWidth<T extends HTMLElement>() {
  const [w, setW] = useState(0);
  const ref = useRef<T | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (cr?.width) setW(Math.round(cr.width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

export default function TrendHRV() {
  const { rows: all } = useRecoveryData();
  const [weeks, setWeeks] = useState<number>(2);
  const [loading, setLoading] = useState<boolean>(false);

  // HYBRID PARAMS – môžeš si doladiť:
  const MIN_PX_PER_POINT = 12;  // min. pixlov na 1 deň; pod týmto prahom sa zapne scroll
  const MIN_CANVAS_W = 160;     // safety min šírka canvasu

  // spinner pri zmene rozsahu
  useEffect(() => { setLoading(true); }, [weeks]);

  // orež na posledných N dní
  const days = weeks * 7;
  const rows = useMemo(() => (days > 0 ? all.slice(-days) : all), [all, days]);

  // vypni spinner po prepočte dát
  useEffect(() => {
    const t = requestAnimationFrame(() => setLoading(false));
    return () => cancelAnimationFrame(t);
  }, [rows]);

  // dáta
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

  // datasets
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

  // options – fit-to-container; autoSkip sa postará o hustotu tickov
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
        decimation: { enabled: true, algorithm: "lttb" },
      },
      scales: {
        ...(base.scales ?? {}),
        x: {
          ...(base.scales as any)?.x,
          ticks: { autoSkip: true, maxRotation: 0 },
        },
      },
    };
  }, [labelsISO, hrv, baselineArr, comments]);

  // HYBRID: zmeraj šírku a rozhodni, či treba scrollovať
  const [wrapRef, wrapW] = useContainerWidth<HTMLDivElement>();
  const pts = labelsISO.length;
  const pxPerPointFit = pts > 0 ? (wrapW || 0) / pts : (wrapW || 0);
  const needScroll = pts > 0 && pxPerPointFit < MIN_PX_PER_POINT;
  const canvasMinWidth = needScroll
    ? Math.max(MIN_CANVAS_W, pts * MIN_PX_PER_POINT)
    : 0;

  return (
    <div className={`${CARD} relative min-w-0 text-left`}>
      {/* HEADER – vľavo, kompaktné paddingy */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex flex-wrap items-start gap-2">
          <h2 className="text-lg font-bold mr-2">Detail — HRV (RMSSD)</h2>
          <select
            value={weeks}
            onChange={(e) => setWeeks(Number(e.target.value))}
            className={`${inputClass} h-8 text-xs w-[112px] shrink-0 self-start`}
            title="Rozsah"
          >
            <option value={2}>2 týždne</option>
            <option value={4}>4 týždne</option>
            <option value={8}>8 týždňov</option>
            <option value={12}>12 týždňov</option>
          </select>
        </div>
      </div>

      {/* BODY – fit-to-container + auto scroll fallback */}
      <div ref={wrapRef} className="w-full">
        <div
          className="overflow-x-auto overflow-y-hidden rounded-xl min-w-0"
          style={{ WebkitOverflowScrolling: "touch", contain: "inline-size" }}
        >
          <div className="relative" style={{ height: THEME.chart.weeklyHeight }}>
            {loading && (
              <div className="absolute inset-0 grid place-items-center z-10 bg-black/10">
                <LoadingSpinner size="trend" />
              </div>
            )}
            <div
              style={{
                width: needScroll ? "auto" : "100%",
                minWidth: needScroll ? `${canvasMinWidth}px` : undefined,
                height: "100%",
                maxWidth: "none",
              }}
            >
              <Line data={data} options={options} />
            </div>
          </div>
        </div>

        {/* voliteľný hint */}
        <div className="px-4 pb-3 pt-2 text-xs opacity-80">
          Tip: dlhší rozsah je horizontálne rolovateľný.
        </div>
      </div>
    </div>
  );
}