// src/features/widgets/WidgetPareto8020.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Doughnut } from "react-chartjs-2";
import type { ChartData, ChartOptions } from "chart.js";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { API_URL } from "@/shared/config";
import { useUserId } from "@/shared/hooks/useUserId";
import OpenerWidget from "@/features/widgets/OpenerWidget";
import { THEME } from "@/shared/theme/tokens";

ChartJS.register(ArcElement, Tooltip, Legend);

type Props = {
  onOpenTrend?: () => void;
  weeks?: 2 | 4 | 8 | 12;
  sport?: string | null;
  debug?: boolean;
};

type WidgetResp = {
  success: boolean;
  data?: {
    easy_min: number | string;
    hard_min: number | string;
    total_min?: number | string;
  };
  detail?: string;
};

const toNum = (v: unknown, d = 0) =>
  Number.isFinite(Number(v)) ? Number(v) : d;

// ⚠️ fixné, výrazné farby (bez THEME)
const EASY_COLOR = THEME.chart.easy80
const HARD_COLOR = THEME.chart.hard20

export default function WidgetPareto8020({
  onOpenTrend,
  weeks = 2,
  sport = null,
  debug = false,
}: Props) {
  const { userId } = useUserId();
  const [payload, setPayload] = useState<WidgetResp | null>(null);

  useEffect(() => {
    if (!userId) return;
    const qs = new URLSearchParams({ days: String(7 * weeks) });
    if (sport) qs.set("sport", sport);
    const url = `${API_URL}/analytics/pareto8020/widget/${userId}?${qs.toString()}`;
    if (debug) console.log("[8020][widget] GET", url);

    fetch(url, { cache: "no-store" })
      .then(r => r.json())
      .then(j => {
        if (debug) console.log("[8020][widget] payload", j);
        setPayload(j);
      })
      .catch(e => {
        console.warn("[8020][widget] error", e);
        setPayload(null);
      });
  }, [userId, weeks, sport, debug]);

  const d = payload?.data;
  const easy = toNum(d?.easy_min, 0);
  const hard = toNum(d?.hard_min, 0);
  const total = toNum(d?.total_min, easy + hard);

  const easyPct = total > 0 ? Math.round((easy / total) * 100) : 0;
  const hardPct = Math.max(0, 100 - easyPct);

  const data: ChartData<"doughnut", number[], string> = useMemo(
    () => ({
      labels: ["Easy", "Hard"],
      datasets: [
        {
          data: [easy, hard],
          backgroundColor: [EASY_COLOR, HARD_COLOR],
          borderWidth: 0,
          hoverOffset: 2,
        },
      ],
    }),
    [easy, hard]
  );

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
              const v = (ctx.parsed as number) ?? 0;
              const pct = total > 0 ? Math.round((v / total) * 100) : 0;
              return `${ctx.label}: ${v} min (${pct}%)`;
            },
          },
        },
      },
    }),
    [total]
  );

  const donutSize = 160;

  return (
    <div
      className="bg-white dark:bg-gray-800 p-4 rounded shadow select-none"
      onClick={onOpenTrend}
      role="button"
      aria-label="Open 80/20 trend"
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold opacity-80">
          Posledné {weeks} týždne – 80/20
        </h3>
        <span className="text-xs opacity-60">
          {total ? `${Math.round(total)} min` : ""}
        </span>
      </div>

      <div className="flex items-center gap-4">
        {/* neutralizujeme vplyv globálnych filtrov/opacít na <canvas> */}
        <div
          className="relative mx-auto"
          style={{
            width: donutSize,
            height: donutSize,
            filter: "none",
            mixBlendMode: "normal",
            isolation: "isolate",
            opacity: 1,
          }}
        >
          <Doughnut data={data} options={options} />
          <div
            className="absolute inset-0 flex items-center justify-center font-bold"
            style={{ color: "#fff", pointerEvents: "none" }}
          >
            {easyPct}% / {hardPct}%
          </div>
        </div>

        {/* vlastná legenda s bodkami (čistý inline štýl) */}
        <div className="flex flex-col gap-2 text-xs" aria-hidden>
          <div className="flex items-center gap-2">
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: EASY_COLOR,
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
                background: HARD_COLOR,
                display: "inline-block",
              }}
            />
            <span>Hard</span>
          </div>
        </div>
      </div>

      <div className="mt-3 text-xs opacity-70">
        Easy: {Math.round(easy)} min • Hard: {Math.round(hard)} min
      </div>
    </div>
  );
}