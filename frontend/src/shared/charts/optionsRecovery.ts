// src/shared/charts/optionsRecovery.ts
import type { ChartOptions } from "chart.js";
import { THEME } from "@/shared/theme/tokens";
import { isMonday, formatWeekRange } from "@/shared/utils/recovery";

type RecoveryLineOptsParams = {
  labelsISO: string[];
  yTitle: string;
  tooltipTitleForIndex?: (i: number) => string;
  tooltipLabelForItem?: (ctx: any) => string;
  tooltipFilter?: (item: any) => boolean;
};

export function buildRecoveryLineOptions({
  labelsISO,
  yTitle,
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
        position: THEME.chart.legendPosition,
        labels: {
          usePointStyle: true,
          pointStyle: "circle",
          boxWidth: 6,
          boxHeight: 6,
          padding: 10,
          // ⬇️ skryť datasets s labelmi začínajúcimi na "_"
          filter: (legendItem) => !(legendItem.text || "").startsWith("_"),
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
            return `${ctx.dataset?.label || ""}: ${ctx.formattedValue}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          // týždenný grid – len pondelky
          color: (ctx: any) => {
            const idx = ctx?.index ?? 0;
            const iso = labelsISO[idx] ?? "";
            return isMonday(iso) ? THEME.chart.grid : "transparent";
          },
        },
        ticks: {
          autoSkip: false,
          maxRotation: 55,
          minRotation: 55,
          callback: (_: any, idx: number) => {
            const iso = labelsISO[idx] ?? "";
            return isMonday(iso) ? formatWeekRange(iso) : "";
          },
        },
      },
      y: {
        beginAtZero: false,
        title: { display: true, text: yTitle },
        grid: { color: THEME.chart.grid },
      },
    },
  };
}
