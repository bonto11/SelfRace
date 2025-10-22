// src/features/widgets/WidgetPareto8020.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Doughnut } from "react-chartjs-2";
import type { ChartData, ChartOptions, Plugin } from "chart.js";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { API_URL } from "@/shared/config";
import { useUserId } from "@/shared/hooks/useUserId";

ChartJS.register(ArcElement, Tooltip, Legend);

type Props = { onOpenTrend?: () => void; weeks?: 2 | 4 | 8 | 12; sport?: string | null; };
type WidgetResp = { success: boolean; data?: { easy_min: number; hard_min: number; total_min: number; days: number; }; };

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
      .then(r => r.json()).then(setPayload).catch(() => setPayload(null));
  }, [userId, weeks, sport]);

  const E = Number(payload?.data?.easy_min ?? 0);
  const H = Number(payload?.data?.hard_min ?? 0);
  const T = Math.max(0, E + H);

  // ---------- DATA ----------
  const data: ChartData<"doughnut", number[], string> = useMemo(() => ({
    labels: ["Easy", "Hard"],
    datasets: [{
      data: [E, H],
      backgroundColor: [GREEN, RED],
      borderWidth: 0,
      hoverOffset: 0,
    }]
  }), [E, H]);

  // ---------- CENTER TEXT ----------
  const centerText: Plugin<"doughnut"> = {
    id: "centerText",
    afterDraw(chart) {
      const ds = chart.data.datasets?.[0]?.data as number[] | undefined;
      const a = Number(ds?.[0] ?? 0);
      const b = Number(ds?.[1] ?? 0);
      const tot = Math.max(0, a + b);
      const easyPct = tot ? Math.round((a / tot) * 100) : 0;
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

  // ---------- OPTIONS ----------
  const options: ChartOptions<"doughnut"> = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: true,
    aspectRatio: 1,               // ⬅️ drž 1:1
    rotation: Math.PI,            // štart zľava
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

  // ---------- „Koľko chýba“ vysvetlenie ----------
  // (A) Presun v rámci rovnakého TOTAL: nájdi m, ktoré treba presunúť z Hard do Easy.
  //     E' = E + m, H' = H - m, E'/T = 0.8 => m = 0.8T - E
  const moveFromHardToEasy = Math.round(0.8 * T - E);

  // (B) Pevné HARD, iba pridávaš Easy: E'/ (E'+H) = 0.8 => E' = 4H => Δ = 4H - E
  const addEasyWithHardFixed = Math.round(4 * H - E);

  return (
    <div
      className="bg-white dark:bg-gray-800 p-4 rounded shadow cursor-pointer select-none"
      onClick={onOpenTrend} role="button" aria-label="Open 80/20 trend"
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold opacity-80">Posledné {weeks} týždne – 80/20</h3>
        <span className="text-xs opacity-60">{T ? `${Math.round(T)} min` : ""}</span>
      </div>

      {/* Žiadne CSS výšky na wrapperi – dáme pevnú veľkosť priamo canvasu */}
      <div className="mx-auto flex items-center justify-center">
        <Doughnut key={`${E}-${H}`} data={data} options={options} plugins={[centerText]} width={220} height={220} />
      </div>

      <div className="mt-3 text-xs opacity-80">
        Easy: {Math.round(E)} min • Hard: {Math.round(H)} min
      </div>

      {T > 0 && (
        <div className="mt-1 text-xs opacity-70 space-y-1">
          {/* A) Presun v rámci rovnakého total */}
          {moveFromHardToEasy > 0
            ? <>Presuň <b>{moveFromHardToEasy} min</b> z Hard do Easy, aby to bolo presne 80/20.</>
            : moveFromHardToEasy < 0
              ? <>Máš o <b>{Math.abs(moveFromHardToEasy)} min</b> Easy naviac oproti 80/20.</>
              : <>Si presne na 80/20 ✔</>}
          {/* B) Alternatíva s pevným Hard */}
          <div className="opacity-60">
            (Ak nechceš znižovať Hard a len pridávať Easy: pridaj {addEasyWithHardFixed >= 0 ? `+${addEasyWithHardFixed}` : `${addEasyWithHardFixed}`} min Easy)
          </div>
        </div>
      )}
    </div>
  );
}