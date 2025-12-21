import type { ChartOptions } from "chart.js";
import { THEME } from "@/app/shared/theme/tokens";

type BuildOpts = {
  onClick?: ChartOptions<"bar" | "line">["onClick"];
  tooltipLabel?: (label: string, v: number) => string;
  showLegend?: boolean;
};

export function buildWeeklyOptions(
  metric: "km" | "time" | "trimp",
  monoMax: number,
  strainMax: number,
  extra?: BuildOpts
): ChartOptions<"bar" | "line"> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },

    // ✅ konzistentné bary (rovnaké ako widgety)
    datasets: {
      bar: {
        maxBarThickness: THEME.chart.bar.maxThickness,
        categoryPercentage: THEME.chart.bar.categoryPct,
        barPercentage: THEME.chart.bar.barPct,
      },
    },

    elements: {
      point: { radius: 2, hitRadius: 8 },
    },

    plugins: {
      legend: {
        position: THEME.chart.legendPosition,
        display: extra?.showLegend ?? true,
        labels: {
          usePointStyle: true,
          pointStyle: "circle",
          boxWidth: 6,
          boxHeight: 6,
          padding: 10,
        },
      },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const label = ctx.dataset.label || "";
            const v = (ctx.parsed.y ?? 0) as number;
            return extra?.tooltipLabel
              ? extra.tooltipLabel(label, v)
              : `${label}: ${v}`;
          },
        },
      },
    },

    onClick: extra?.onClick,

    layout: { padding: { left: 8, right: 16 } },

    // ✅ fixnuté osi: ľavá hlavná, vpravo mono+strain, bez prekryvov
    scales: {
      y: {
        beginAtZero: true,
        position: "left",
        title: {
          display: true,
          text: metric === "km" ? "km" : metric === "time" ? "min" : "TRIMP",
          color: THEME.color.text,
        },
        ticks: { color: THEME.color.text },
        grid: { color: THEME.chart.grid },
      },
      y1: {
        position: "right",
        min: 0,
        max: Math.max(3, Math.ceil(monoMax + 0.3)),
        grid: { drawOnChartArea: false },
        title: { display: true, text: "Monotony", color: THEME.chart.monotony },
        ticks: { color: THEME.chart.monotony },
        border: { color: THEME.chart.monotony },
        weight: 1,
      },
      y2: {
        position: "right",
        min: 0,
        max: Math.ceil(strainMax * 1.1),
        grid: { drawOnChartArea: false },
        title: { display: true, text: "Strain", color: THEME.chart.strain },
        ticks: { color: THEME.chart.strain },
        border: { color: THEME.chart.strain },
        weight: 1,
      },
      x: {
        grid: { color: THEME.chart.gridSoft },
        ticks: {
          autoSkip: false,
          maxRotation: 90,
          minRotation: 90, // natvrdo zvislo
          padding: 8,
          font: { size: 10 },
          align: "center",
        },
      },
    },
  };
}
