// src/shared/charts/options.ts
import type { ChartOptions } from "chart.js";
import { THEME } from "@/shared/theme/tokens";

type BuildOpts = {
  onClick?: ChartOptions<'bar'|'line'>['onClick'];
  tooltipLabel?: (label: string, v: number) => string;
};

export function buildWeeklyOptions(
  metric: 'km'|'time'|'trimp',
  monoMax: number,
  strainMax: number,
  extra?: BuildOpts
): ChartOptions<'bar'|'line'> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: THEME.chart.legendPosition },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const label = ctx.dataset.label || '';
            const v = (ctx.parsed.y ?? 0) as number;
            return extra?.tooltipLabel ? extra.tooltipLabel(label, v) : `${label}: ${v}`;
          },
        },
      },
    },
    onClick: extra?.onClick,
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: metric === 'km' ? 'km' : metric === 'time' ? 'min' : 'TRIMP',
        },
        grid: { color: THEME.chart.grid },
      },
      y1: {
        position: 'right',
        min: 0,
        max: Math.max(3, Math.ceil(monoMax + 0.5)),
        grid: { drawOnChartArea: false },
        title: { display: true, text: 'Monotony' },
      },
      y2: {
        position: 'right',
        min: 0,
        max: Math.ceil(strainMax * 1.1),
        grid: { drawOnChartArea: false },
        title: { display: true, text: 'Strain' },
      },
      x: { grid: { color: THEME.chart.gridSoft } },
    },
  };
}
