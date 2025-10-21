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
    total_min: number;
    easy_pct: number; // 0..100
    hard_pct: number; // 0..100
    days: number;
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

  // --- fetch ---
  useEffect(() => {
    if (!userId) return;
    const q = new URLSearchParams({ days: String(7 * weeks) });
    if (sport) q.set("sport", sport);
    fetch(`${API_URL}/analytics/pareto8020/widget/${userId}?${q.toString()}`, {
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((j) => setPayload(j))
      .catch(() => setPayload(null));
  }, [userId, weeks, sport]);

  // normalizované čísla (žiadne NaN)
  const P = payload?.data ?? {
    easy_min: 0,
    hard_min: 0,
    total_min: 0,
    easy_pct: 0,
    hard_pct: 0,
    days: 7 * weeks,
  };
  const EASY = Math.max(0, Math.round(Number(P.easy_min || 0)));
  const HARD = Math.max(0, Math.round(Number(P.hard_min || 0)));
  const EASY_P = Math.max(0, Math.round(Number(P.easy_pct || 0)));
  const HARD_P = Math.max(0, Math.round(Number(P.hard_pct || 0)));

  // center text plugin – škáluje font podľa veľkosti plátna
  const centerText: Plugin<"doughnut"> = useMemo(
    () => ({
      id: "centerText",
      afterDraw(chart) {
        const { ctx, chartArea } = chart;
        if (!chartArea) return;
        const midX = (chartArea.left + chartArea.right) / 2;
        const midY = (chartArea.top + chartArea.bottom) / 2;
        const size = Math.min(chart.width, chart.height);
        const fontPx = Math.max(12, Math.floor(size * 0.10)); // ~10 % priemeru
        ctx.save();
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `bold ${fontPx}px system-ui, -apple-system, Segoe UI, Roboto`;
        ctx.fillStyle = "#fff";
        ctx.fillText(`${EASY_P}% / ${HARD_P}%`, midX, midY);
        ctx.restore();
      },
    }),
    [EASY_P, HARD_P]
  );

  // chart data/options
  const data: ChartData<"doughnut", number[], string> = useMemo(
    () => ({
      labels: ["Easy", "Hard"],
      datasets: [
        {
          data: [EASY, HARD],
          backgroundColor: [THEME.chart.easy80, THEME.chart.hard20],
          borderWidth: 0,
        },
      ],
    }),
    [EASY, HARD]
  );

  const options: ChartOptions<"doughnut"> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      cutout: "70%",
      plugins: {
        legend: { display: true, position: THEME.chart.legendPosition },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const v = Number(ctx.parsed) || 0;
              const total = Math.max(1, EASY + HARD);
              const pct = Math.round((v / total) * 100);
              return `${ctx.label}: ${v} min (${pct}%)`;
            },
          },
        },
      },
    }),
    [EASY, HARD]
  );

  // jednotný vzhľad karty + menší graf
  return (
    <div
      className={`bg-white dark:bg-gray-800 p-3 rounded shadow cursor-pointer select-none ${className}`}
      onClick={onOpenTrend}
      role="button"
      aria-label="Open 80/20 trend"
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold opacity-80">
          Posledné {weeks} týždne – 80/20
        </h3>
        <span className="text-xs opacity-60">
          {P.total_min ? `${Math.round(P.total_min)} min` : ""}
        </span>
      </div>

      {/* menší, konzistentný rozmer s ostatnými widgetmi */}
      <div className="mx-auto w-[140px] h-[140px] md:w-[160px] md:h-[160px]">
        <Doughnut data={data} options={options} plugins={[centerText]} />
      </div>

      <div className="mt-2 text-xs opacity-70">
        Easy: {EASY} min • Hard: {HARD} min
      </div>
    </div>
  );
}