// src/features/recovery/components/TrendHRV.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Line as LineChart } from "react-chartjs-2";
import type { ChartData, ChartOptions } from "chart.js";
import { ensureChartJSRegistered } from "@/shared/charts/register";
import { THEME } from "@/shared/theme/tokens";
import {
  rollingMean,
  bandsAround,
  wrapToLines,
} from "@/shared/utils/recovery";
import { useRecoveryData } from "@/shared/components/dataProviders/RecoveryDataProvider";
import LoadingSpinner from "@/shared/components/ui/LoadingSpinner";
import { CARD, WIDGET_CARD, WIDGET_INNER } from "@/shared/ui/classes";
import Button from "@/shared/components/ui/Button";
import { inputClass } from "@/shared/ui";

ensureChartJSRegistered();

export default function TrendHRV() {
  const { rows: all } = useRecoveryData();

  // lookback v týždňoch
  const [weeks, setWeeks] = useState<number>(2);
  const [loading, setLoading] = useState(false);

  useEffect(() => setLoading(true), [weeks]);

  // -- dátové okno
  const days = weeks * 7;
  const rows = useMemo(() => (days > 0 ? all.slice(-days) : all), [all, days]);

  useEffect(() => {
    const t = requestAnimationFrame(() => setLoading(false));
    return () => cancelAnimationFrame(t);
  }, [rows]);

  const labelsISO = useMemo(() => rows.map((r) => r.date), [rows]);

  const hrv = useMemo(
    () =>
      rows.map((r) =>
        typeof r.HRV_avg_ms === "number" ? (r.HRV_avg_ms as number) : NaN
      ),
    [rows]
  );

  const baselineArr = useMemo(
    () =>
      rollingMean(
        rows.map((r) =>
          typeof r.HRV_avg_ms === "number" ? (r.HRV_avg_ms as number) : null
        ),
        14
      ),
    [rows]
  );
  const { lower, upper } = useMemo(
    () => bandsAround(baselineArr, 0.05),
    [baselineArr]
  );

  const comments = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) if (r.comments) m.set(r.date, r.comments);
    return m;
  }, [rows]);

  // === DATASETS
  const data: ChartData<"line", number[], string> = useMemo(() => {
    const toNum = (xs: (number | null)[]) =>
      xs.map((v) => (typeof v === "number" ? v : NaN));

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
          fill: "-1" as const,
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
          pointRadius: 2,
          borderWidth: 2,
          tension: 0.2,
          spanGaps: true,
          order: 3,
        },
      ],
    };
  }, [labelsISO, lower, upper, baselineArr, hrv]);

  // === KOMPAKTNÉ OPTIONS (menšie písmo + malé okraje)
  const options: ChartOptions<"line"> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      layout: {
        // Tesné okraje, aby graf „nevyčnieval“ výškou
        padding: { top: 4, right: 6, bottom: 10, left: 6 },
      },
      plugins: {
        legend: {
          position: THEME.chart.legendPosition,
          labels: {
            usePointStyle: true,
            pointStyle: "circle",
            boxWidth: 6,
            boxHeight: 6,
            padding: 8,
            font: { size: 10 },
          },
        },
        tooltip: {
          callbacks: {
            title: (items) => {
              const i = items?.[0]?.dataIndex ?? 0;
              const iso = labelsISO[i] ?? "";
              return new Date(iso + "T00:00:00").toLocaleDateString("sk-SK");
            },
            label: (ctx) => {
              const idx = ctx.dataIndex ?? 0;
              const lines: string[] = [];
              if (ctx.datasetIndex === 3) {
                const v = hrv[idx];
                if (Number.isFinite(v)) lines.push(`HRV: ${Math.round(v)} ms`);
                const c = comments.get(labelsISO[idx] ?? "");
                if (c) lines.push(...wrapToLines(c, 44));
              }
              if (ctx.datasetIndex === 2) {
                const b = baselineArr[idx];
                if (Number.isFinite(b as number))
                  lines.push(`Baseline: ${Math.round(b as number)} ms`);
              }
              return lines.length
                ? lines
                : `${ctx.dataset?.label ?? ""}: ${ctx.formattedValue ?? ""}`;
            },
            // zobrazuj len baseline+HRV, pásmo skryté
            labelColor: (ctx) =>
              ctx.datasetIndex <= 1
                ? { borderColor: "transparent", backgroundColor: "transparent" }
                : undefined,
          },
          filter: (item) => item.datasetIndex === 2 || item.datasetIndex === 3,
        },
      },
      scales: {
        y: {
          beginAtZero: false,
          grid: { color: THEME.chart.grid },
          title: { display: true, text: "ms" },
          ticks: { font: { size: 10 }, padding: 4 },
        },
        x: {
          grid: { color: THEME.chart.gridSoft },
          ticks: {
            autoSkip: true,
            maxRotation: 0,
            padding: 4,
            font: { size: 10 },
          },
        },
      },
      elements: { point: { hitRadius: 8 } },
    }),
    [labelsISO, hrv, comments, baselineArr]
  );

  // === ROZMERY/SCROLL – rovnaká filozofia ako pri 80/20 a WeeklyLoad
  // menšia výška + horizontálny scroll pri dlhšom období
  const height = 200; // <— spraví to menšie (ak chceš ešte menej, daj 180)
  const pxPerLabel = THEME.chart?.dayPxPerLabel ?? 18; // šírka na 1 deň
  const minWidth = Math.max(360, Math.round(labelsISO.length * pxPerLabel));

  return (
    <div className={`${CARD} relative`}>
      {/* HEADER (s paddingom) */}
      <div className={`${WIDGET_CARD} pb-0`}>
        <div className={`${WIDGET_INNER}`}>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Detail — HRV (RMSSD)</h2>
            <select
              value={weeks}
              onChange={(e) => setWeeks(Number(e.target.value))}
              className={`${inputClass} h-8 text-xs w-[130px]`}
              title="Lookback"
            >
              <option value={2}>2 týždne</option>
              <option value={4}>4 týždne</option>
              <option value={8}>8 týždňov</option>
              <option value={12}>12 týždňov</option>
            </select>
          </div>
        </div>
      </div>

      {/* GRAF (bez extra paddingu) */}
      <div
        className="overflow-x-auto overflow-y-hidden rounded-b-2xl"
        style={{ WebkitOverflowScrolling: "touch", contain: "inline-size" }}
      >
        <div className="relative" style={{ height }}>
          {loading && (
            <div className="absolute inset-0 grid place-items-center z-10 bg-black/10">
              <LoadingSpinner size="trend" />
            </div>
          )}
          <div style={{ minWidth, height: "100%", maxWidth: "none" }}>
            <LineChart data={data} options={options} />
          </div>
        </div>
      </div>
    </div>
  );
}