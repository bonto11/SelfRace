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
};

type WidgetResp = {
  success: boolean;
  data?: {
    easy_min: number | string;
    hard_min: number | string;
    total_min?: number | string;
    easy_pct?: number;
    hard_pct?: number;
    days?: number;
  };
  detail?: string;
};

export default function WidgetPareto8020({
  onOpenTrend,
  weeks = 2,
  sport = null,
}: Props) {
  const { userId } = useUserId();
  const [payload, setPayload] = useState<WidgetResp | null>(null);

  // fetch
  useEffect(() => {
    if (!userId) return;
    const q = new URLSearchParams({ days: String(7 * weeks) });
    if (sport) q.set("sport", sport);
    fetch(`${API_URL}/analytics/pareto8020/widget/${userId}?${q.toString()}`, {
      cache: "no-store",
    })
      .then((r) => r.json())
      .then(setPayload)
      .catch(() => setPayload(null));
  }, [userId, weeks, sport]);

  // robustné čísla + percentá z minút
  const raw = payload?.data ?? {};
  const easyMin = Number(raw.easy_min) || 0;
  const hardMin = Number(raw.hard_min) || 0;
  const totalMin = Number(raw.total_min) || easyMin + hardMin;
  const easyPct = totalMin > 0 ? Math.round((easyMin / totalMin) * 100) : 0;
  const hardPct = Math.max(0, 100 - easyPct);

  // fallback farby (ak by THEME nebol dostupný)
  const easyColor = THEME?.chart?.easy80 ?? "#4ADE80";
  const hardColor = THEME?.chart?.hard20 ?? "#F87171";

  // center text plugin
  const centerText: Plugin<"doughnut"> = useMemo(
    () => ({
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
        ctx.fillText(`${easyPct}% / ${hardPct}%`, midX, midY);
        ctx.restore();
      },
    }),
    [easyPct, hardPct]
  );

  // dataset
  const data: ChartData<"doughnut", number[], string> = useMemo(
    () => ({
      labels: ["Easy", "Hard"],
      datasets: [
        {
          data: [easyMin, hardMin],
          backgroundColor: [easyColor, hardColor],
          borderWidth: 0,
        },
      ],
    }),
    [easyMin, hardMin, easyColor, hardColor]
  );

  // options (bez legendy – urobíme vlastnú s bodkami)
  const options: ChartOptions<"doughnut"> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      cutout: "70%",
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const v = ctx.parsed as number;
              const total = Math.max(1, easyMin + hardMin);
              const pct = Math.round((v / total) * 100);
              return `${ctx.label}: ${v} min (${pct}%)`;
            },
          },
        },
      },
    }),
    [easyMin, hardMin]
  );

  // veľkosť grafu tak, aby sedel s ostatnými widgetmi
  const donutSize = 160; // px

  return (
    <div
      className="bg-white dark:bg-gray-800 p-4 rounded shadow select-none"
      role="button"
      aria-label="Open 80/20 trend"
      onClick={onOpenTrend}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold opacity-80">
          Posledné {weeks} týždne – 80/20
        </h3>
        <span className="text-xs opacity-60">
          {totalMin ? `${Math.round(totalMin)} min` : ""}
        </span>
      </div>

      <div className="flex items-center gap-4">
        {/* Donut */}
        <div
          className="mx-auto"
          style={{ width: donutSize, height: donutSize }}
          aria-hidden
        >
          <Doughnut data={data} options={options} plugins={[centerText]} />
        </div>

        {/* Vlastná legenda s bodkami */}
        <div className="flex flex-col gap-2 text-xs opacity-80">
          <div className="flex items-center gap-2">
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                backgroundColor: easyColor,
                display: "inline-block",
              }}
            />
            <span>Easy</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                backgroundColor: hardColor,
                display: "inline-block",
              }}
            />
            <span>Hard</span>
          </div>
        </div>
      </div>

      <div className="mt-3 text-xs opacity-70">
        Easy: {Math.round(easyMin)} min • Hard: {Math.round(hardMin)} min
      </div>
    </div>
  );
}