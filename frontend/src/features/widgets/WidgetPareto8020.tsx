// src/features/widgets/WidgetPareto8020.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Doughnut } from "react-chartjs-2";
import type { ChartData, ChartOptions, Plugin } from "chart.js";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { API_URL } from "@/shared/config";
import { useUserId } from "@/shared/hooks/useUserId";

ChartJS.register(ArcElement, Tooltip, Legend);

type Props = {
  onOpenTrend?: () => void;
  weeks?: 2 | 4 | 8 | 12;
  sport?: string | null;
};

type WidgetResp = {
  success: boolean;
  data?: {
    easy_min: number;
    hard_min: number;
    total_min: number;
    days: number;
  };
};

const GREEN = "#00E676";
const RED   = "#FF5252";

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

  const E = Number(payload?.data?.easy_min ?? 0);
  const H = Number(payload?.data?.hard_min ?? 0);
  const T = Math.max(0, E + H);

  // donut data
  const data: ChartData<"doughnut", number[], string> = useMemo(() => ({
    labels: ["Easy", "Hard"],
    datasets: [{
      data: [E, H],
      backgroundColor: [GREEN, RED],
      borderWidth: 0,
      hoverOffset: 0,
    }]
  }), [E, H]);

  // stredový text – vždy si prečíta aktuálne dáta z chartu
  const centerText: Plugin<"doughnut"> = {
    id: "centerText",
    afterDraw(chart) {
      const ds = chart.data.datasets?.[0]?.data as number[] | undefined;
      const a = Number(ds?.[0] ?? 0);
      const b = Number(ds?.[1] ?? 0);
      const total = Math.max(0, a + b);
      const easyPct = total ? Math.round((a / total) * 100) : 0;
      const hardPct = Math.max(0, 100 - easyPct);

      const { ctx, chartArea } = chart;
      const midX = (chartArea.left + chartArea.right) / 2;
      const midY = (chartArea.top + chartArea.bottom) / 2;
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "bold 18px system-ui, -apple-system, Segoe UI, Roboto";
      ctx.fillStyle = "#fff";
      ctx.fillText(`${easyPct}% / ${hardPct}%`, midX, midY);
      ctx.restore();
    }
  };

  // rotácia zľava, štvorcový pomer strán
  const options: ChartOptions<"doughnut"> = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,     // ⬅️ dôležité
    rotation: Math.PI,              // štart na ľavej strane
    circumference: 2 * Math.PI,
    cutout: "70%",
    plugins: {
      legend: {
        display: true,
        position: "right",
        labels: { usePointStyle: true, pointStyle: "circle" }
      },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const v = Number(ctx.parsed) || 0;
            const tot = T || 1;
            const pct = Math.round((v / tot) * 100);
            return `${ctx.label}: ${Math.round(v)} min (${pct}%)`;
          }
        }
      }
    }
  }), [T]);

  // dorovnanie na 80/20 pri rovnakom celkovom čase
  const deltaEasy = Math.round(0.8 * T - E);
  const deltaEasyFixH = Math.round(4 * H - E);

  return (
    <div
      className="bg-white dark:bg-gray-800 p-4 rounded shadow cursor-pointer select-none"
      onClick={onOpenTrend}
      role="button"
      aria-label="Open 80/20 trend"
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold opacity-80">Posledné {weeks} týždne – 80/20</h3>
        <span className="text-xs opacity-60">{T ? `${Math.round(T)} min` : ""}</span>
      </div>

      {/* štvorcový kontajner = žiadny „šikmý“ donut */}
      <div className="mx-auto" style={{ width: 220, height: 220 }}>
        <Doughnut key={`${E}-${H}`} data={data} options={options} plugins={[centerText]} />
      </div>

      <div className="mt-3 text-xs opacity-80">
        Easy: {Math.round(E)} min • Hard: {Math.round(H)} min
      </div>

      <div className="mt-1 text-xs opacity-70">
        {T > 0 ? (
          <>
            {deltaEasy > 0
              ? <>Chýba <b>+{deltaEasy} min</b> Easy (na presných 80/20).</>
              : deltaEasy < 0
                ? <>Máš o <b>{Math.abs(deltaEasy)} min</b> Easy viac než 80/20.</>
                : <>Si presne na 80/20 ✔</>
            }
            <div className="opacity-60">
              (Alternatíva s pevnými Hard: {deltaEasyFixH >= 0 ? `pridaj +${deltaEasyFixH}` : `uber ${Math.abs(deltaEasyFixH)}`} min Easy)
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}