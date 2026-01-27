import type { ChartOptions } from "chart.js";
import { appColors } from "@/app/shared/theme/app_colors";

type BuildOpts = {
  onClick?: ChartOptions<"bar" | "line">["onClick"];
  tooltipLabel?: (label: string, v: number) => string;
  showLegend?: boolean;
};

export const OPTIONS = {

  legendPosition: 'top' as const,

  weeklyPxPerLabel: 56,  /** ✅ koľko px pripadá na 1 týždeň v detaile (match s widgetom) */

  Height: 360,
  HeightCompact: 180,

  bar: {
    maxThickness: 12,
    categoryPct: 0.6,
    barPct: 0.7,
  },
  pxPerLabel: 26,  // 🔒 konzistencia barov + vodorovný layout

  sportLabels: {
    run: 'Run',
    bike: 'Bike',
    strength: 'Strength',
    mixed: 'Mixed',
    skate: 'Skate',
    walk: 'Walk',
    hike: 'Hike',
    swim: 'Swim',
    other: 'Other',
  } as Record<string, string>,
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
        maxBarThickness: OPTIONS.bar.maxThickness,
        categoryPercentage: OPTIONS.bar.categoryPct,
        barPercentage: OPTIONS.bar.barPct,
      },
    },

    elements: {
      point: { radius: 2, hitRadius: 8 },
    },

    plugins: {
      legend: {
        position: OPTIONS.legendPosition,
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
          color: appColors.chartGrid,
        },
        ticks: { color: appColors.chartGrid },
        grid: { color: appColors.chartGrid },
      },
      y1: {
        position: "right",
        min: 0,
        max: Math.max(3, Math.ceil(monoMax + 0.3)),
        grid: { drawOnChartArea: false },
        title: { display: true, text: "Monotony", color: appColors.chartLine1 },
        ticks: { color: appColors.chartLine1 },
        border: { color: appColors.chartLine1},
        weight: 1,
      },
      y2: {
        position: "right",
        min: 0,
        max: Math.ceil(strainMax * 1.1),
        grid: { drawOnChartArea: false },
        title: { display: true, text: "Strain", color: appColors.chartLine2 },
        ticks: { color:appColors.chartLine2 },
        border: { color: appColors.chartLine2 },
        weight: 1,
      },
      x: {
        grid: { color: appColors.chartGrid },
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
