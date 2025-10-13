"use client";

import { useMemo, useRef, useState, useLayoutEffect } from "react";
import { Chart as MixedChart } from "react-chartjs-2";
import type { ChartData, ChartOptions } from "chart.js";
import { THEME } from "@/shared/theme/tokens";

type Props = {
  /** hlavný dátový graf (bez osí) */
  data: ChartData<"bar" | "line", (number | null)[], string>;
  /** options pre hlavný graf – osy budú vypnuté (vykreslia sa vo fixných vrstvách) */
  options?: ChartOptions<"bar" | "line">;
  /** X labels (kvôli spodnej fixnej osi) */
  labels: string[];
  /** výška dátového grafu */
  height: number;
  /** px šírka na 1 label (rovnaké ako vo widgetoch) */
  pxPerLabel?: number; // default 26
  /** text ľavej osi – "km" | "min" | "TRIMP" */
  leftAxisLabel: string;
  /** maxima pre pravé osi */
  rightMonoMax: number;   // napr. Math.max(3, ceil(monoMax+0.5))
  rightStrainMax: number; // napr. ceil(strainMax*1.1)
};

export default function ChartFrozenAxes({
  data,
  options,
  labels,
  height,
  pxPerLabel = 26,
  leftAxisLabel,
  rightMonoMax,
  rightStrainMax,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // šírky fixných osí
  const leftAxisW = 44;  // hlavná metrika (väčšie, nech sa zmestí titulok)
  const rightAxisW = 56; // dve pravé osi vedľa seba

  const contentWidth = useMemo(
    () => Math.max(labels.length * pxPerLabel, 320),
    [labels, pxPerLabel]
  );

  // jednotné nastavenie barov = rovnaké ako vo widgete
  const baseDatasets = {
    bar: { maxBarThickness: 12, categoryPercentage: 0.6, barPercentage: 0.7 },
  } as ChartOptions<"bar" | "line">["datasets"];

  // ===== 1) HLAVNÝ ŠIROKÝ (scroll) GRAF – bez osí =====
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
      tooltip: options?.plugins?.tooltip, // necháme tvoje tooltipy
    },
    layout: {
      padding: {
        left: leftAxisW + 8,
        right: rightAxisW + 8,
        top: 0,
        bottom: 24, // rezerva pre spodnú fixnú X os
      },
    },
    scales: {
      // vypneme všetky osy – vyrenderujú sa zvlášť
      x: { display: false, grid: { display: false } },
      y: { display: false, grid: { display: false } },
      y1: { display: false, grid: { display: false } },
      y2: { display: false, grid: { display: false } },
    },
  };

  // ===== 2) ĽAVÁ Y os = hlavná metrika =====
  const yLeftOpts: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    scales: {
      x: { display: false, grid: { display: false } },
      y: {
        position: "left",
        grid: { color: THEME.chart.grid },
        ticks: { color: "#cfd3dc" },
        border: { color: "#cfd3dc" },
        title: { display: true, text: leftAxisLabel, color: "#cfd3dc" },
      },
    },
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
  };
  const yLeftData: ChartData<"line"> = { labels, datasets: [] };

  // ===== 3) PRAVÉ Y osy = Monotony (y1) + Strain (y2), obe na pravej strane =====
  const yRightOpts: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    scales: {
      // Trik: použijeme dve rôzne Y škály na pravej strane
      x: { display: false, grid: { display: false } },
      y1: {
        position: "right",
        min: 0,
        max: rightMonoMax,
        grid: { drawOnChartArea: false }, // mriežka len na osi
        ticks: { color: THEME.chart.monotony },
        border: { color: THEME.chart.monotony },
        title: { display: true, text: "Monotony", color: THEME.chart.monotony },
      },
      y2: {
        position: "right",
        min: 0,
        max: rightStrainMax,
        grid: { drawOnChartArea: false },
        ticks: { color: THEME.chart.strain },
        border: { color: THEME.chart.strain },
        title: { display: true, text: "Strain", color: THEME.chart.strain },
      },
    },
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
  };
  const yRightData: ChartData<"line"> = { labels, datasets: [] };

  // ===== 4) SPODNÁ X os – fixná =====
  const xBottomOpts: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    scales: {
      x: {
        grid: { color: THEME.chart.gridSoft },
        ticks: { color: "#cfd3dc", maxRotation: 0, autoSkip: true, maxTicksLimit: 8 },
        border: { color: "#cfd3dc" },
      },
      y: { display: false, grid: { display: false } },
    },
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
  };
  const xBottomData: ChartData<"line"> = { labels, datasets: [] };

  // držíme posun pre spodnú X os, aby „sedela“ pri scrolli
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
      {/* ľavá fixná metrická os */}
      <div className="absolute left-0 top-0" style={{ width: leftAxisW, height }}>
        <MixedChart type="line" data={yLeftData} options={yLeftOpts} />
      </div>

      {/* pravé fixné osi: y1=Monotony (zelená), y2=Strain (žltá) */}
      <div className="absolute right-0 top-0" style={{ width: rightAxisW, height }}>
        <MixedChart type="line" data={yRightData} options={yRightOpts} />
      </div>

      {/* scrollovateľný obsah (len dáta) */}
      <div
        ref={scrollRef}
        className="overflow-x-auto overflow-y-hidden"
        style={{ height, paddingLeft: leftAxisW, paddingRight: rightAxisW }}
      >
        <div style={{ width: contentWidth, height: "100%" }}>
          <MixedChart type="bar" data={data} options={dataChartOpts} />
        </div>
      </div>

      {/* spodná fixná X os */}
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
