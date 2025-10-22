"use client";

import { useMemo } from "react";
import { Chart as LineChart } from "react-chartjs-2";
import type { ChartData, ChartOptions, Plugin } from "chart.js";
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  TimeSeriesScale,
  CategoryScale,
  Tooltip,
  Legend,
} from "chart.js";
import { THEME } from "@/shared/theme/tokens";

ChartJS.register(
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  TimeSeriesScale,
  Tooltip,
  Legend
);

type Props = {
  xs: number[];               // sekundy od 0
  ys: (number | null)[];      // HR
  height?: number;            // px
  compact?: boolean;          // malý náhľad
};

/** fix zóny – neskôr ich vytiahni z profilu */
const Z = {
  max: 207,
  z1: 154,
  z2: 173,
  z3: 183,
  z4: 193,
};
const zoneBg = [
  { to: Z.z1,  fill: "rgba(59,130,246,0.08)" },  // modrá
  { to: Z.z2,  fill: "rgba(34,197,94,0.08)" },   // zelená
  { to: Z.z3,  fill: "rgba(234,179,8,0.08)" },   // žltá
  { to: Z.z4,  fill: "rgba(249,115,22,0.08)" },  // oranžová
  { to: Z.max, fill: "rgba(239,68,68,0.08)" },   // červená
];

/** podfarbenie pásiem HR (pred vykreslením) */
const zoneBackgroundPlugin: Plugin<"line"> = {
  id: "zoneBackground",
  beforeDraw(chart) {
    const { ctx, chartArea, scales } = chart;
    if (!chartArea) return;
    const y = scales.y;
    ctx.save();
    zoneBg.forEach((z, i) => {
      const yTop = y.getPixelForValue(i === 0 ? -9999 : zoneBg[i - 1].to);
      const yBottom = y.getPixelForValue(z.to);
      ctx.fillStyle = z.fill;
      ctx.fillRect(chartArea.left, Math.min(yTop, yBottom), chartArea.width, Math.abs(yBottom - yTop));
    });
    ctx.restore();
  },
};

export default function HrChart({ xs, ys, height = 140, compact = false }: Props) {
  const n = Math.min(xs.length, ys.length);
  const data: ChartData<"line", (number | null)[], number> = useMemo(
    () => ({
      labels: xs.slice(0, n),
      datasets: [
        {
          label: "HR",
          data: ys.slice(0, n),
          borderColor: "#22D3EE",
          backgroundColor: "#22D3EE",
          pointRadius: 0,
          spanGaps: true,
          tension: 0.25,
          segment: {
            borderColor: ctx => {
              const v = ctx.p1.parsed.y as number;
              if (v <= Z.z1) return "#60A5FA";
              if (v <= Z.z2) return "#34D399";
              if (v <= Z.z3) return "#FBBF24";
              if (v <= Z.z4) return "#F97316";
              return "#EF4444";
            },
          },
        },
      ],
    }),
    [xs, ys, n]
  );

  const options: ChartOptions<"line"> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { left: 28, right: 28, top: compact ? 6 : 16, bottom: compact ? 6 : 22 } },
      interaction: { intersect: false, mode: "index" },
      plugins: {
        legend: {
          display: !compact,
          position: "top",
          align: "center",
          labels: { usePointStyle: true, pointStyle: "circle", boxWidth: 6, boxHeight: 6, padding: 8 },
        },
        tooltip: {
          callbacks: {
            title: (items) => {
              const s = items?.[0]?.parsed.x ?? 0;
              const mm = Math.floor(s / 60), ss = s % 60;
              return `${mm}m ${ss}s`;
            },
            label: (ctx) => `HR: ${Math.round(ctx.parsed.y)} bpm`,
          },
        },
      },
      scales: {
        x: {
          ticks: {
            callback: (v) => {
              const s = Number(v);
              const mm = Math.floor(s / 60), ss = s % 60;
              return `${mm}m ${ss}s`;
            },
            padding: 6,
            maxRotation: 0,
          },
          grid: { color: THEME.chart.gridSoft },
          title: { display: !compact, text: "čas", padding: 12 },
        },
        y: {
          min: 108,                 // nech je vždy trocha “air”
          max: Z.max,
          ticks: { padding: 6 },
          grid: { color: THEME.chart.grid },
          title: { display: !compact, text: "bpm", padding: 12 },
        },
      },
    }),
    [compact]
  );

  return (
    <div style={{ height }}>
      <LineChart type="line" data={data} options={options} plugins={[zoneBackgroundPlugin]} />
    </div>
  );
}