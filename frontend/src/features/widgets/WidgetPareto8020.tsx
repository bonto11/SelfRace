// src/features/widgets/WidgetPareto8020.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Doughnut } from "react-chartjs-2";
import type { ChartData, ChartOptions } from "chart.js";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { API_URL } from "@/shared/config";
import { useUserId } from "@/shared/hooks/useUserId";
import { THEME } from "@/shared/theme/tokens";

ChartJS.register(ArcElement, Tooltip, Legend);

type Props = {
  onOpenTrend?: () => void;
  weeks?: 2 | 4 | 8 | 12;
  sport?: string | null;
  debug?: boolean;           // 👈 dočasne zapnuté farby/logy
};

type WidgetData = {
  easy_min: number | string;
  hard_min: number | string;
  total_min?: number | string;
};

type WidgetResp = {
  success: boolean;
  data?: WidgetData;
  detail?: string;
};

const num = (v: unknown, fallback = 0): number => {
  const n = typeof v === "string" || typeof v === "number" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
};

export default function WidgetPareto8020({
  onOpenTrend,
  weeks = 2,
  sport = null,
  debug = true,
}: Props) {
  const { userId } = useUserId();
  const [payload, setPayload] = useState<WidgetResp | null>(null);

  useEffect(() => {
    if (!userId) return;
    const q = new URLSearchParams({ days: String(7 * weeks) });
    if (sport) q.set("sport", sport);
    const url = `${API_URL}/analytics/pareto8020/widget/${userId}?${q.toString()}`;

    console.debug("[8020] fetch →", url);
    fetch(url, { cache: "no-store" })
      .then(r => r.json())
      .then((j: WidgetResp) => {
        console.debug("[8020] payload:", j);
        setPayload(j);
      })
      .catch(e => {
        console.debug("[8020] fetch error:", e);
        setPayload(null);
      });
  }, [userId, weeks, sport]);

  const d = payload?.data;
  const easyMin = num(d?.easy_min, 0);
  const hardMin = num(d?.hard_min, 0);
  const totalMin = num(d?.total_min, easyMin + hardMin);
  const easyPct = totalMin > 0 ? Math.round((easyMin / totalMin) * 100) : 0;
  const hardPct = Math.max(0, 100 - easyPct);

  const easyColor = THEME?.chart?.easy80 ?? "#4ADE80";
  const hardColor = THEME?.chart?.hard20 ?? "#F87171";

  if (debug) {
    console.debug("[8020] computed:", { easyMin, hardMin, totalMin, easyPct, hardPct, easyColor, hardColor });
  }

  const data: ChartData<"doughnut", number[], string> = useMemo(() => ({
    labels: ["Easy", "Hard"],
    datasets: [{
      data: [easyMin, hardMin],
      backgroundColor: [easyColor, hardColor],   // ⬅️ jasne nastavené farby
      borderWidth: 0,
      hoverOffset: 2,
    }],
  }), [easyMin, hardMin, easyColor, hardColor]);

  const options: ChartOptions<"doughnut"> = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    cutout: "70%",
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const v = (ctx.parsed as number) ?? 0;
            const total = Math.max(1, easyMin + hardMin);
            const pct = Math.round((v / total) * 100);
            return `${ctx.label}: ${v} min (${pct}%)`;
          }
        }
      }
    }
  }), [easyMin, hardMin]);

  const donutSize = 160;

  return (
    <div
      className="bg-white dark:bg-gray-800 p-4 rounded shadow select-none"
      onClick={onOpenTrend}
      role="button"
      aria-label="Open 80/20 trend"
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold opacity-80">Posledné {weeks} týždne – 80/20</h3>
        <span className="text-xs opacity-60">{totalMin ? `${Math.round(totalMin)} min` : ""}</span>
      </div>

      <div className="flex items-center gap-4">
        {/* wrapper neutralizuje prípadné globálne filtre/opacitu */}
        <div
          className="relative mx-auto"
          style={{
            width: donutSize,
            height: donutSize,
            filter: "none",
            mixBlendMode: "normal",
            isolation: "isolate",
          }}
        >
          <Doughnut data={data} options={options} />
          {/* overlay so stredovým textom */}
          <div
            className="absolute inset-0 flex items-center justify-center text-white font-bold"
            style={{ pointerEvents: "none" }}
          >
            {easyPct}% / {hardPct}%
          </div>
        </div>

        {/* vlastná legenda s bodkami */}
        <div className="flex flex-col gap-2 text-xs opacity-80" aria-hidden>
          <div className="flex items-center gap-2">
            <span style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: easyColor, display: "inline-block" }} />
            <span>Easy</span>
          </div>
          <div className="flex items-center gap-2">
            <span style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: hardColor, display: "inline-block" }} />
            <span>Hard</span>
          </div>
        </div>
      </div>

      <div className="mt-3 text-xs opacity-70">
        Easy: {Math.round(easyMin)} min • Hard: {Math.round(hardMin)} min
      </div>

      {/* DEBUG sekcia – môžeš vymazať keď to bude ok */}
      {debug && (
        <div className="mt-2 text-[10px] opacity-60">
          colors: <code>{easyColor}</code> / <code>{hardColor}</code> •
          data: <code>[{easyMin}, {hardMin}]</code>
        </div>
      )}
    </div>
  );
}