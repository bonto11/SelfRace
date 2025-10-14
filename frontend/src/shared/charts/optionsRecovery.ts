import type { ChartOptions } from "chart.js";
import { THEME } from "@/shared/theme/tokens";
import { isMonday, formatWeekRange } from "@/shared/utils/recovery";

type RecoveryLineOptsParams = {
  labelsISO: string[];               // ISO pre každý DEŇ
  yTitle: string;                    // "bpm" | "ms" | "min" ...
  yTickFormatter?: (v: number) => string; // voliteľné formátovanie Y osi
  tooltipTitleForIndex?: (i: number) => string;
  tooltipLabelForItem?: (ctx: any) => string | string[];
  tooltipFilter?: (item: any) => boolean;
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
    parsing: false,
    interaction: { mode: "nearest", axis: "x", intersect: false },
    plugins: {
      legend: {
        position: THEME.chart.legendPosition,
        labels: { usePointStyle: true, pointStyle: "circle", boxWidth: 6, boxHeight: 6, padding: 10 },
      },
      tooltip: {
        displayColors: true,
        filter: (item: any) => (tooltipFilter ? tooltipFilter(item) : true),
        callbacks: {
          title: (items: any[]) => {
            const i = items?.[0]?.dataIndex ?? 0;
            if (tooltipTitleForIndex) return tooltipTitleForIndex(i);
            const iso = labelsISO[i] ?? "";
            return new Date(iso + "T00:00:00").toLocaleDateString("sk-SK");
          },
          label: (ctx: any) => (tooltipLabelForItem ? tooltipLabelForItem(ctx) : `${ctx.dataset?.label}: ${ctx.formattedValue}`),
        },
      },
    },
    scales: {
      x: {
        grid: {
          // @ts-ignore
          color: (ctx: any) => {
            const idx = typeof ctx?.index === "number" ? ctx.index : -1;
            if (idx < 0) return THEME.chart.gridSoft;
            const iso = labelsISO[idx] ?? "";
            return isMonday(iso) ? THEME.chart.grid : "transparent";
          },
        },
        ticks: {
          autoSkip: false,
          maxRotation: 55,
          minRotation: 55,
          callback: (_val: any, idx: number) => {
            const iso = labelsISO[idx] ?? "";
            return isMonday(iso) ? formatWeekRange(iso) : "";
          },
        },
      },
      y: {
        beginAtZero: false,
        title: { display: true, text: yTitle },
        grid: { color: THEME.chart.grid },
        ticks: yTickFormatter
          ? {
              callback: (raw: any) => yTickFormatter(Number(raw)),
            }
          : undefined,
      },
    },
  };
}
