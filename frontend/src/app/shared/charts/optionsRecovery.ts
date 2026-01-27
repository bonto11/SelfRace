// Jeden spoločný „builder“ pre všetky recovery line grafy
// - 55° popisky týždňov
// - grid len v pondelky
// - nič nepretečie (maintainAspectRatio:false; výška cez wrapper)

import type { ChartOptions } from "chart.js";
import { isMonday, formatWeekRange } from "@/app/shared/utils/time";
import { appColors } from "../theme/app_colors";

export const OPTIONS = {

  legendPosition: 'top' as const,

  weeklyPxPerLabel: 56, /** ✅ koľko px pripadá na 1 týždeň v detaile (match s widgetom) */

  Height: 360,
  HeightCompact: 180,

  
  bar: {
    maxThickness: 12,
    categoryPct: 0.6,
    barPct: 0.7,
  },
  pxPerLabel: 26,// 🔒 konzistencia barov + vodorovný layout
};

type RecoveryLineOptsParams = {
  labelsISO: string[]; // "YYYY-MM-DD" pre každý DEŇ v grafe (x-os zobrazuje len týždne)
  yTitle: string; // "bpm", "ms", "min"...
  yTickFormatter?: (v: number) => string; // voliteľné formátovanie Y
  tooltipTitleForIndex?: (i: number) => string;
  tooltipLabelForItem?: (ctx: any) => string | string[];
  tooltipFilter?: (item: any) => boolean;

/** pevné limity osi Y (ak chceš override) */
  yMin?: number;
  yMax?: number;
};

export function buildRecoveryLineOptions({
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
          // týždenný grid – len pondelky
          // @ts-ignore – stačí nám index
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
