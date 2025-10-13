// src/features/widgets/ChartFrozenAxes.tsx
"use client";

import { useMemo, useRef, useState, useLayoutEffect } from "react";
import { Chart as MixedChart } from "react-chartjs-2";
import type { ChartData, ChartOptions } from "chart.js";
import { THEME } from "@/shared/theme/tokens";

type Props = {
  /** hlavný dátový graf (bez osí) */
  data: ChartData<"bar" | "line", (number | null)[], string>;
  /** options pre hlavný graf – osy budú vypnuté, bar nastavenia doplníme */
  options?: ChartOptions<"bar" | "line">;
  /** len X-ové labels (kvôli spodnej fixnej osi) */
  labels: string[];
  /** výška dátového grafu (napr. THEME.chart.weeklyHeight) */
  height: number;
  /** px šírka na 1 label – rovnaké ako vo widgete, aby tyčky mali rovnakú hrúbku */
  pxPerLabel?: number; // default 26
};

export default function ChartFrozenAxes({
  data,
  options,
  labels,
  height,
  pxPerLabel = 26,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  // rezervuj miesto na Y-osi (ľavá+pravá)
  const leftAxisW = 36;   // Monotony
  const rightAxisW = 40;  // Strain

  const contentWidth = useMemo(
    () => Math.max(labels.length * pxPerLabel, 320),
    [labels, pxPerLabel]
  );

  // --- options pre jednotlivé vrstvy ---
  const baseDatasets = {
    bar: { maxBarThickness: 12, categoryPercentage: 0.6, barPercentage: 0.7 },
  } as ChartOptions<"bar" | "line">["datasets"];

  // 1) HLAVNÝ ŠIROKÝ GRAF – bez osí, len dáta
  const dataChartOpts: ChartOptions<"bar" | "line"> = {
    ...options,
    maintainAspectRatio: false,
    datasets: baseDatasets,
    plugins: {
      ...(options?.plugins || {}),
      legend: {
        ...(options?.plugins?.legend || {}),
        position: THEME.chart.legendPosition,
        labels: { usePointStyle: true, pointStyle: "circle", boxWidth: 6, boxHeight: 6, padding: 10 },
      },
    },
    layout: {
      padding: {
        left: leftAxisW + 8,
        right: rightAxisW + 8,
        top: 0,
        bottom: 24, // necháme miesto pre spodnú fixnú os
      },
    },
    scales: {
      // všetky osy vypnuté (vykreslí ich overlay graf)
      x: { display: false, grid: { display: false } },
      y: { display: false, grid: { display: false } },
      y1: { display: false, grid: { display: false } },
      y2: { display: false, grid: { display: false } },
    },
  };

  // 2) ĽAVÁ Y os (Monotony)
  const yLeftOpts: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    scales: {
      x: { display: false, grid: { display: false } },
      y: {
        position: "left",
        min: 0,
        max: 3,
        grid: { color: THEME.chart.grid },
        ticks: { color: "#ccc" },
        title: { display: true, text: "Monotony" },
      },
    },
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
  };
  const yLeftData: ChartData<"line"> = { labels, datasets: [] };

  // 3) Pravá Y os (Strain)
  const yRightOpts: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    scales: {
      x: { display: false, grid: { display: false } },
      y: {
        position: "right",
        min: 0,
        // max nechávame na parent options (Chart.js sa tu neviaže na data)
        // zobrazíme len mriežku „mimo“ hlavného grafu
        grid: { color: THEME.chart.grid, drawOnChartArea: false },
        ticks: { color: "#ccc" },
        title: { display: true, text: "Strain" },
      },
    },
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
  };
  const yRightData: ChartData<"line"> = { labels, datasets: [] };

  // 4) Spodná X os – fixná
  const xBottomOpts: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    scales: {
      x: {
        grid: { color: THEME.chart.gridSoft },
        ticks: { color: "#ccc", maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
      },
      y: { display: false, grid: { display: false } },
    },
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
  };
  const xBottomData: ChartData<"line"> = { labels, datasets: [] };

  // aby spodná os „sedela“ s posunom dát, premapujeme scrollLeft na
  // transform X spodného canvasu (mimiko – posun ticks oproti dátam je vizuálne prirodzený).
  const [xShift, setXShift] = useState(0);
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => setXShift(el.scrollLeft);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="relative" style={{ width: "100%" }}>
      {/* fixné Y-osi */}
      <div
        className="absolute left-0 top-0"
        style={{ width: leftAxisW, height }}
      >
        <MixedChart type="line" data={yLeftData} options={yLeftOpts} />
      </div>
      <div
        className="absolute right-0 top-0"
        style={{ width: rightAxisW, height }}
      >
        <MixedChart type="line" data={yRightData} options={yRightOpts} />
      </div>

      {/* scrollovateľné Dáta */}
      <div
        ref={scrollRef}
        className="overflow-x-auto overflow-y-hidden"
        style={{ height, paddingLeft: leftAxisW, paddingRight: rightAxisW }}
      >
        <div style={{ width: contentWidth, height: "100%" }}>
          <MixedChart type="bar" data={data} options={dataChartOpts} />
        </div>
      </div>

      {/* fixná X os (dole) */}
      <div
        className="relative mt-1"
        style={{ height: 36, overflow: "hidden", paddingLeft: leftAxisW, paddingRight: rightAxisW }}
      >
        <div style={{ transform: `translateX(${-xShift}px)` }}>
          <div style={{ width: contentWidth }}>
            <MixedChart type="line" data={xBottomData} options={xBottomOpts} />
          </div>
        </div>
      </div>
    </div>
  );
}
