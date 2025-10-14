// Jeden spoločný „builder“ pre všetky recovery line grafy
// - 55° popisky týždňov
// - grid len v pondelky
// - nič nepretečie (maintainAspectRatio:false; výšku rieši wrapper)

import type { ChartOptions, ScriptableScaleContext } from "chart.js";
import { THEME } from "@/shared/theme/tokens";
import { isMonday, formatWeekRange } from "@/shared/utils/recovery";

type RecoveryLineOptsParams = {
  labelsISO: string[];
  yTitle: string;
  tooltipTitleForIndex?: (i: number) => string;
  tooltipLabelForItem?: (ctx: any) => string;   // <- striktne string
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
    parsing: false,                        // dôležité kvôli NaN/null
    interaction: { mode: "nearest", axis: "x", intersect: false },
    plugins: {
      legend: {
        position: THEME.chart.legendPosition,
        labels: { usePointStyle: true, pointStyle: "circle", boxWidth: 6, boxHeight: 6, padding: 10 },
      },
      tooltip: {
        filter: (item) => (tooltipFilter ? tooltipFilter(item) : true),
        callbacks: {
          title: (items) => {
            const i = items?.[0]?.dataIndex ?? 0;
            if (tooltipTitleForIndex) return tooltipTitleForIndex(i);
            const iso = labelsISO[i] ?? "";
            const d = new Date(iso + "T00:00:00");
            return d.toLocaleDateString("sk-SK");
          },
          label: (ctx) => {
            if (tooltipLabelForItem) return tooltipLabelForItem(ctx);
            return `${ctx.dataset?.label || ""}: ${ctx.formattedValue}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          color: (ctx: ScriptableScaleContext) => {
            const idx = (ctx as any)?.index ?? 0;
            const iso = labelsISO[idx] ?? "";
            return isMonday(iso) ? THEME.chart.grid : "transparent";
          },
        },
        ticks: {
          autoSkip: false,
          maxRotation: 55,
          minRotation: 55,
          callback: (_val, idx: number) => {
            const iso = labelsISO[idx] ?? "";
            if (!isMonday(iso)) return "";     // popisok len v pondelok
            return formatWeekRange(iso);       // napr. "6–12.10." / "28.9.–5.10."
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
