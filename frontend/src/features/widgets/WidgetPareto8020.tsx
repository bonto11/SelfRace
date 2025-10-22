// src/features/widgets/WidgetPareto8020.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Doughnut } from "react-chartjs-2";
import type { ChartData, ChartOptions, Plugin } from "chart.js";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
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
    easy_min: number;
    hard_min: number;
    total_min: number;
    easy_pct?: number;
    hard_pct?: number;
    days: number;
  };
  detail?: string;
};

const GREEN = THEME.chart.easy80;
const RED   = THEME.chart.hard20;

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

  // percentá robustne (aj ak BE nepošle)
  const easyPct = T ? Math.round((E / T) * 100) : 0;
  const hardPct = Math.max(0, 100 - easyPct);

  // Δ easy pri rovnakom celkovom čase (presun z/tam kde treba)
  const deltaEasy = Math.round(0.8 * T - E);   // + => chýba Easy, - => príliš veľa Easy
  // Alternatíva pri fixnom Hard (iba info)
  const deltaEasyFixH = Math.round(4 * H - E); // cieľ E' = 4*H

  // stredový text s percentami
  const centerText: Plugin<"doughnut"> = {
    id: "centerText",
    afterDraw(chart) {
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
    },
  };

  const data: ChartData<"doughnut", number[], string> = useMemo(() => ({
    labels: ["Easy", "Hard"],
    datasets: [{
      data: [E, H],
      backgroundColor: [GREEN, RED],
      borderWidth: 0,
    }]
  }), [E, H]);

  const options: ChartOptions<"doughnut"> = useMemo(() => ({
    responsive: true,
    // ⬇️ zelená začne z ĽAVA a pôjde doprava
    rotation: Math.PI,          // štart na ľavej strane (180°)
    circumference: 2 * Math.PI, // celý kruh
    cutout: "70%",
    plugins: {
      legend: { display: true, position: "right", labels: { usePointStyle: true, pointStyle: "circle" } },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const v = ctx.parsed as number;
            const pct = T ? Math.round((v / T) * 100) : 0;
            return `${ctx.label}: ${Math.round(v)} min (${pct}%)`;
          }
        }
      }
    }
  }), [T]);

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

      <div className="mx-auto" style={{ width: 220, height: 220 }}>
        <Doughnut data={data} options={options} plugins={[centerText]} />
      </div>

      <div className="mt-3 text-xs opacity-80">
        Easy: {Math.round(E)} min • Hard: {Math.round(H)} min
      </div>

      {/* odporúčanie na dorovnanie 80/20 */}
      <div className="mt-1 text-xs opacity-70">
        {T > 0 ? (
          <>
            {deltaEasy > 0
              ? <>Chýba <b>+{deltaEasy} min</b> Easy (na presných 80/20).</>
              : deltaEasy < 0
                ? <>Máš o <b>{Math.abs(deltaEasy)} min</b> Easy viac než 80/20 (pri rovnakom čase).</>
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