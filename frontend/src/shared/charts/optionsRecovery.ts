//shared/charts/optionsRecovery


// Jeden spoločný „builder“ pre všetky recovery line grafy
// - 55° popisky týždňov
// - grid len v pondelky
// - nič nepretečie (maintainAspectRatio:false; výška dáš cez wrapper)

import type { ChartOptions } from "chart.js";
import { THEME } from "@/shared/theme/tokens";
import { isMonday, formatWeekRange } from "@/shared/utils/recovery";

type RecoveryLineOptsParams = {
  labelsISO: string[];      // "YYYY-MM-DD" pre každý DEŇ v grafe (aj keď x-os zobrazuje len týždne)
  yTitle: string;           // "bpm", "ms", "min"...
  // tieto dve nechávame na konkrétny graf (napr. RHR potrebuje komentáre atď.)
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
    parsing: false,
    interaction: { mode: "nearest", axis: "x", intersect: false },
    plugins: {
      legend: {
        position: THEME.chart.legendPosition,
        labels: { usePointStyle: true, pointStyle: "circle", boxWidth: 6, boxHeight: 6, padding: 10 },
      },
      tooltip: {
        // ❗️Filter patrí na úroveň tooltipu (nie do callbacks)
        filter: (item: any) => (tooltipFilter ? tooltipFilter(item) : true),
        callbacks: {
          // titulok – dátum podľa indexu
          title: (items: any[]) => {
            const i = items?.[0]?.dataIndex ?? 0;
            if (tooltipTitleForIndex) return tooltipTitleForIndex(i);
            const iso = labelsISO[i] ?? "";
            const d = new Date(iso + "T00:00:00");
            return d.toLocaleDateString("sk-SK");
          },
          // vlastné labely (napr. RHR + komentár)
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
          // @ts-ignore – Chart.js tu dáva ScriptableScaleContext, stačí nám index
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
          callback: (val: any, idx: number) => {
            const iso = labelsISO[idx] ?? "";
            if (!isMonday(iso)) return "";          // nezobrazuj každý deň
            return formatWeekRange(iso);            // napr. "6–12.10." / "28.9.–5.10."
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
