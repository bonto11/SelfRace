import type { ChartOptions } from "chart.js";
import { THEME } from "@/shared/theme/tokens";

/**
 * Spoločné options pre recovery trendy (denné body, týždenné značky).
 *
 * @param yTitle   Jednotka osi Y (napr. "bpm", "ms", "min")
 * @param yMinMax  Explicitné min/max alebo null ak nechceš
 * @param weekLabelForIndex  Funkcia ktorá vráti týždenný popisok pre daný index (inak vráť "")
 */
export function buildRecoveryOptions(
  yTitle: string,
  yMinMax: { min?: number | null; max?: number | null } = {},
  weekLabelForIndex?: (index: number) => string
): ChartOptions<"line"> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "nearest", intersect: true }, // len body
    elements: { point: { radius: 3, hitRadius: 8 } },
    plugins: {
      legend: {
        position: THEME.chart.legendPosition,
        labels: {
          usePointStyle: true,
          pointStyle: "circle",
          boxWidth: 6,
          boxHeight: 6,
          padding: 10,
        },
      },
      tooltip: {
        // title/label nastavuje komponent (cez callbacks) – tu necháme default
      },
    },
    scales: {
      y: {
        beginAtZero: false,
        min: yMinMax.min ?? undefined,
        max: yMinMax.max ?? undefined,
        grid: { color: THEME.chart.grid },
        title: { display: true, text: yTitle },
      },
      x: {
        // grid iba pri týždenných značkách (ostatné "priehľadné")
        grid: {
          color: (ctx) =>
            ctx.index % 7 === 6 ? THEME.chart.gridSoft : "rgba(0,0,0,0)",
        },
        ticks: {
          autoSkip: false,
          // 55° natočenie popiskov
          minRotation: 55,
          maxRotation: 55,
          callback: (_value, index) =>
            weekLabelForIndex ? weekLabelForIndex(index) : ("" as any),
        },
      },
    },
  };
}
