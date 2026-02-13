"use client";

import type { ChartOptions } from "chart.js";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { isMonday, formatWeekRange } from "@/app/shared/utils/time";

/* ---------- Types & Opts ---------- */

type BuildOpts = {
  onClick?: ChartOptions<"bar" | "line">["onClick"];
  tooltipLabel?: (label: string, v: number) => string;
  showLegend?: boolean;
};

export const LOOKBACK_OPTIONS = (t: any) => [
  { value: "2", label: `2 ${t("common.weeksShort.count2to4")}` },
  { value: "4", label: `4 ${t("common.weeksShort.count2to4")}` },
  { value: "8", label: `8 ${t("common.weeksShort.count5plus")}` },
  { value: "12", label: `12 ${t("common.weeksShort.count5plus")}` },
];

export const SPORT_SELECT_OPTIONS = (t: any) => [
  { value: "all", label: t("common.sports.all") },
  { value: "run", label: t("common.sports.run") },
  { value: "ride", label: t("common.sports.ride") },
  { value: "strength", label: t("common.sports.strength") },
  { value: "mixed", label: t("common.sports.mixed") },
  { value: "skate", label: t("common.sports.skate") },
  { value: "other", label: t("common.sports.other") },
];

export const OPTIONS = {
  legendPosition: "top" as const,
  weeklyPxPerLabel: 56,
  Height: 360,
  HeightCompact: 180,
  bar: {
    maxThickness: 12,
    categoryPct: 0.6,
    barPct: 0.7,
  },
  pxPerLabel: 26,
  sportLabels: {
    run: "Run",
    bike: "Bike",
    ride: "Ride",
    strength: "Strength",
    mixed: "Mixed",
    skate: "Skate",
    walk: "Walk",
    hike: "Hike",
    swim: "Swim",
    other: "Other",
  } as Record<string, string>,
};

export const WEEK_OPTIONS = (t: any) => [
  { value: "2", label: `2 ${t("common.weeksShort.count2to4")}` },
  { value: "4", label: `4 ${t("common.weeksShort.count2to4")}` },
  { value: "8", label: `8 ${t("common.weeksShort.count5plus")}` },
  { value: "12", label: `12 ${t("common.weeksShort.count5plus")}` },
];
/* ---------- Weekly Progress Chart Builder ---------- */

/**
 * Vybuduje konfiguráciu pre týždenný graf progresu (Bar + Line).
 * @param t - funkcia z hooku useT()
 * @param metric - zvolená metrika (km, time, trimp)
 * @param monoMax - maximálna hodnota monotónnosti pre škálovanie osi
 * @param strainMax - maximálna hodnota úsilia pre škálovanie osi
 * @param extra - voliteľné callbacky a nastavenia
 */
export function buildWeeklyOptions(
  t: any, 
  metric: "km" | "time" | "trimp",
  monoMax: number,
  strainMax: number,
  extra?: {
    onClick?: ChartOptions<"bar" | "line">["onClick"];
    tooltipLabel?: (label: string, v: number) => string;
    showLegend?: boolean;
  },
): ChartOptions<"bar" | "line"> {
  
  // Dynamické určenie popisku hlavnej osi Y podľa metriky
  const metricLabel = 
    metric === "km" ? "km" : 
    metric === "time" ? t("common.units.min") : 
    t("common.units.trimp");

  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },

    // Nastavenia stĺpcov pre bar chart
    datasets: {
      bar: {
        maxBarThickness: 12,
        categoryPercentage: 0.6,
        barPercentage: 0.7,
      },
    },

    elements: {
      point: { radius: 2, hitRadius: 8 },
    },

    plugins: {
      legend: {
        position: "top" as const,
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

    scales: {
      // Hlavná os Y (vľavo) - Metrika (km/min/trimp)
      y: {
        beginAtZero: true,
        position: "left",
        title: {
          display: true,
          text: metricLabel,
          color: appColors.chartGrid,
        },
        ticks: { color: appColors.chartGrid },
        grid: { color: appColors.chartGrid },
      },
      // Vedľajšia os Y1 (vpravo) - Monotónnosť
      y1: {
        position: "right",
        min: 0,
        max: Math.max(3, Math.ceil(monoMax + 0.3)),
        grid: { drawOnChartArea: false },
        title: { 
          display: true, 
          text: t("charts.metrics.monotony"), 
          color: appColors.chartLine1 
        },
        ticks: { color: appColors.chartLine1 },
        border: { color: appColors.chartLine1 },
        weight: 1,
      },
      // Vedľajšia os Y2 (vpravo, posunutá) - Úsilie/Strain
      y2: {
        position: "right",
        min: 0,
        max: Math.ceil(strainMax * 1.1),
        grid: { drawOnChartArea: false },
        title: { 
          display: true, 
          text: t("charts.metrics.strain"), 
          color: appColors.chartLine2 
        },
        ticks: { color: appColors.chartLine2 },
        border: { color: appColors.chartLine2 },
        weight: 1,
      },
      // Os X - Týždne
      x: {
        grid: { color: appColors.chartGrid },
        ticks: {
          autoSkip: false,
          maxRotation: 90,
          minRotation: 90,
          padding: 8,
          font: { size: 10 },
          align: "center",
        },
      },
    },
  };
}
/* ---------- Recovery Line Chart Builder ---------- */

type RecoveryLineOptsParams = {
  t: any;
  labelsISO: string[];
  yTitle: string;
  yTickFormatter?: (v: number) => string;
  tooltipTitleForIndex?: (i: number) => string;
  tooltipLabelForItem?: (ctx: any) => string | string[];
  tooltipFilter?: (item: any) => boolean;
  yMin?: number;
  yMax?: number;
};

export function buildRecoveryLineOptions({
  t,
  labelsISO,
  yTitle,
  yTickFormatter,
  tooltipTitleForIndex,
  tooltipLabelForItem,
  tooltipFilter,
}: RecoveryLineOptsParams): ChartOptions<"line"> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: { mode: "nearest", axis: "x", intersect: false },
    plugins: {
      legend: {
        position: OPTIONS.legendPosition,
        labels: {
          usePointStyle: true,
          pointStyle: "circle",
          boxWidth: 6,
          boxHeight: 6,
          padding: 10,
        },
      },
      tooltip: {
        filter: (item: any) => (tooltipFilter ? tooltipFilter(item) : true),
        callbacks: {
          title: (items: any[]) => {
            const i = items?.[0]?.dataIndex ?? 0;
            if (tooltipTitleForIndex) return tooltipTitleForIndex(i);
            const iso = labelsISO[i] ?? "";
            const d = new Date(iso + "T00:00:00");
            return d.toLocaleDateString("sk-SK");
          },
          label: (ctx: any) => {
            if (tooltipLabelForItem) return tooltipLabelForItem(ctx);
            const raw = ctx.parsed?.y as number | undefined;
            const base = `${ctx.dataset?.label || ""}: `;
            if (typeof raw === "number" && yTickFormatter)
              return base + yTickFormatter(raw);
            return base + (ctx.formattedValue ?? "");
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          color: (ctx: any) => {
            const idx = ctx?.index ?? 0;
            const iso = labelsISO[idx] ?? "";
            return isMonday(iso) ? appColors.chartGrid : "transparent";
          },
        },
        ticks: {
          autoSkip: false,
          maxRotation: 55,
          minRotation: 55,
          callback: (_val: any, idx: number) => {
            const iso = labelsISO[idx] ?? "";
            if (!isMonday(iso)) return "";
            return formatWeekRange(iso);
          },
        },
      },
      y: {
        beginAtZero: false,
        title: { display: true, text: yTitle },
        grid: { color: appColors.chartGrid },
        ticks: {
          callback: (v: any) => {
            const num = Number(v);
            return yTickFormatter ? yTickFormatter(num) : String(v);
          },
        },
      },
    },
  };
}

import {
  Chart as ChartJS,
  // scales
  CategoryScale,
  LinearScale,
  // controllers
  BarController,
  LineController,
  // elements
  BarElement,
  LineElement,
  PointElement,
  // plugins
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

// (ak používaš anotácie, odkomentuj):
import annotationPlugin from 'chartjs-plugin-annotation';

let _registered = false;

/**
 * Zaregistruje všetko potrebné pre bar/line aj MIXED grafy.
 * Volaj iba z client komponentov.
 */
export function ensureChartJSRegistered() {
  if (_registered) return;

  ChartJS.register(
    // scales
    CategoryScale,
    LinearScale,
    // controllers
    BarController,
    LineController,
    // elements
    BarElement,
    LineElement,
    PointElement,
    // plugins
    Title,
    Tooltip,
    Legend,
    Filler,
    annotationPlugin,
  );

  _registered = true;
}
