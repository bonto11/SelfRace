"use client";

import { useEffect, useMemo, useState } from "react";
import { Doughnut } from "react-chartjs-2";
import type { ChartData, ChartOptions, Plugin } from "chart.js";
import {
  Chart as ChartJS,
  ArcElement, Tooltip, Legend
} from "chart.js";
import { API_URL } from "@/shared/config";
import { useUserId } from "@/shared/hooks/useUserId";
import { THEME } from "@/shared/theme/tokens";

ChartJS.register(ArcElement, Tooltip, Legend);

type Props = {
  onOpenTrend?: () => void;   // 👈 prop je tu
  weeks?: 2 | 4 | 8 | 12;
  sport?: string | null;      // 'run' | 'bike' | ... | null = všetko
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

export default function WidgetPareto8020({ onOpenTrend, weeks = 2, sport = null }: Props) {
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

  const P = payload?.data ?? { easy_min: 0, hard_min: 0, total_min: 0, easy_pct: 0, hard_pct: 0, days: 7 * weeks };

  // stredový text (percentá)
  const centerText: Plugin<"doughnut"> = {
    id: "centerText",
    afterDraw(chart) {
      const { ctx, chartArea } = chart;
      const midX = (chartArea.left + chartArea.right) / 2;
      const midY = (chartArea.top + chartArea.bottom) / 2;
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "bold 14px system-ui, -apple-system, Segoe UI, Roboto";
      ctx.fillStyle = "#fff";
      ctx.fillText(`${Math.round(P.easy_pct)}% / ${Math.round(P.hard_pct)}%`, midX, midY);
      ctx.restore();
    }
  };

  const data: ChartData<"doughnut", number[], string> = useMemo(() => ({
    labels: ["Easy", "Hard"],
    datasets: [{
      data: [Math.round(P.easy_min), Math.round(P.hard_min)],
      backgroundColor: [THEME.chart.easy80, THEME.chart.hard20],
      borderWidth: 0
    }]
  }), [P.easy_min, P.hard_min]);

  const options: ChartOptions<"doughnut"> = useMemo(() => ({
    responsive: true,
    cutout: "70%",
    plugins: {
      legend: { display: true, position: THEME.chart.legendPosition },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const v = ctx.parsed as number;
            const total = Math.max(1, P.easy_min + P.hard_min);
            const pct = Math.round((v / total) * 100);
            return `${ctx.label}: ${v} min (${pct}%)`;
          }
        }
      }
    }
  }), [P.easy_min, P.hard_min]);

  return (
    <div
      className="bg-white dark:bg-gray-800 p-4 rounded shadow cursor-pointer select-none"
      onClick={onOpenTrend}
      role="button"
      aria-label="Open 80/20 trend"
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold opacity-80">Posledné {weeks} týždne – 80/20</h3>
        <span className="text-xs opacity-60">{P.total_min ? `${Math.round(P.total_min)} min` : ""}</span>
      </div>

      <div className="mx-auto" style={{ width: 180, height: 180 }}>
        <Doughnut data={data} options={options} plugins={[centerText]} />
      </div>

      <div className="mt-3 text-xs opacity-70">
        Easy: {Math.round(P.easy_min)} min • Hard: {Math.round(P.hard_min)} min
      </div>
    </div>
  );
}