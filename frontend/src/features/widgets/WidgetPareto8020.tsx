"use client";

import { useEffect, useMemo, useState } from "react";
import { Doughnut } from "react-chartjs-2";
import type { ChartData, ChartOptions, Plugin } from "chart.js";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { API_URL } from "@/shared/config";
import { useUserId } from "@/shared/hooks/useUserId";
import { THEME } from "@/shared/theme/tokens";

ChartJS.register(ArcElement, Tooltip, Legend);

type Props = {
  onOpenTrend?: () => void;
  weeks?: 2 | 4 | 8 | 12;
  sport?: string | null;
  className?: string;
};

type WidgetResp = {
  success: boolean;
  data?: {
    easy_min: number;
    hard_min: number;
    total_min?: number;
    easy_pct?: number; // BE môže/ nemusí poslať
    hard_pct?: number;
  };
  detail?: string;
};

export default function WidgetPareto8020({
  onOpenTrend,
  weeks = 2,
  sport = null,
  className = "",
}: Props) {
  const { userId } = useUserId();
  const [payload, setPayload] = useState<WidgetResp | null>(null);

  useEffect(() => {
    if (!userId) return;
    const q = new URLSearchParams({ days: String(7 * weeks) });
    if (sport) q.set("sport", sport);
    fetch(`${API_URL}/analytics/pareto8020/widget/${userId}?${q.toString()}`, { cache: "no-store" })
      .then(r => r.json())
      .then(setPayload)
      .catch(() => setPayload(null));
  }, [userId, weeks, sport]);

  // normalizuj dáta
  const easyMin = Math.max(0, Math.round(Number(payload?.data?.easy_min ?? 0)));
  const hardMin = Math.max(0, Math.round(Number(payload?.data?.hard_min ?? 0)));
  const total   = Math.max(1, easyMin + hardMin);
  // fallback: ak BE nedá percentá, spočítaj ich z minút
  const easyPct = Math.max(
    0,
    Math.round(
      Number.isFinite(payload?.data?.easy_pct as number)
        ? (payload!.data!.easy_pct as number)
        : (easyMin / total) * 100
    )
  );
  const hardPct = Math.max(
    0,
    Math.round(
      Number.isFinite(payload?.data?.hard_pct as number)
        ? (payload!.data!.hard_pct as number)
        : 100 - easyPct
    )
  );
  const totalMinShown = Math.max(0, Math.round(Number(payload?.data?.total_min ?? easyMin + hardMin)));

  // center text plugin
  const centerText: Plugin<"doughnut"> = useMemo(
    () => ({
      id: "centerText",
      afterDraw(chart) {
        const { ctx, chartArea } = chart;
        if (!chartArea) return;
        const midX = (chartArea.left + chartArea.right) / 2;
        const midY = (chartArea.top + chartArea.bottom) / 2;
        const fontPx = Math.max(12, Math.floor(Math.min(chart.width, chart.height) * 0.10));
        ctx.save();
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `bold ${fontPx}px system-ui, -apple-system, Segoe UI, Roboto`;
        ctx.fillStyle = "#fff";
        ctx.fillText(`${easyPct}% / ${hardPct}%`, midX, midY);
        ctx.restore();
      },
    }),
    [easyPct, hardPct]
  );

  const data: ChartData<"doughnut", number[], string> = useMemo(
    () => ({
      labels: ["Easy", "Hard"],
      datasets: [
        {
          data: [easyMin, hardMin],
          backgroundColor: [THEME.chart.easy80, THEME.chart.hard20],
          borderWidth: 0,
        },
      ],
    }),
    [easyMin, hardMin]
  );

  const options: ChartOptions<"doughnut"> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      cutout: "70%",
      plugins: {
        legend: {
          display: true,
          position: "right",                   // legenda vpravo
          labels: { usePointStyle: true, pointStyle: "circle", boxWidth: 8, boxHeight: 8, padding: 10 },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const v = Number(ctx.parsed) || 0;
              const pct = Math.round((v / total) * 100);
              return `${ctx.label}: ${v} min (${pct}%)`;
            },
          },
        },
      },
    }),
    [total]
  );

  return (
    <div
      className={`bg-white dark:bg-gray-800 p-3 rounded shadow cursor-pointer select-none ${className}`}
      onClick={onOpenTrend}
      role="button"
      aria-label="Open 80/20 trend"
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold opacity-80">Posledné {weeks} týždne – 80/20</h3>
        <span className="text-xs opacity-60">{totalMinShown ? `${totalMinShown} min` : ""}</span>
      </div>

      <div className="mx-auto w-[140px] h-[140px] md:w-[160px] md:h-[160px]">
        <Doughnut data={data} options={options} plugins={[centerText]} />
      </div>

      <div className="mt-2 text-xs opacity-70">
        Easy: {easyMin} min • Hard: {hardMin} min
      </div>
    </div>
  );
}