// src/features/widgets/WidgetPareto8020.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Doughnut } from "react-chartjs-2";
import type { ChartData, ChartOptions, Plugin } from "chart.js";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import OpenerWidget from "@/features/widgets/OpenerWidget";
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

// úmyselne pevné, aby sme obišli témy/prehlušovanie štýlmi
const GREEN = "#00E676";
const RED   = "#FF5252";

export default function WidgetPareto8020({
  onOpenTrend,
  weeks = 2,
  sport = null,
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

  const E = Number(payload?.data?.easy_min ?? 0);
  const H = Number(payload?.data?.hard_min ?? 0);
  const T = Math.max(0, E + H);

  // cieľ 80/20 – delta len k Easy pri rovnakom T
  // ak je +, chýba Easy; ak je -, máš Easy navyše
  const deltaEasy = Math.round(0.8 * T - E);

  // percentá do stredu
  const pctEasy = T ? Math.round((E / T) * 100) : 0;
  const pctHard = Math.max(0, 100 - pctEasy);

  const data: ChartData<"doughnut", number[], string> = useMemo(
    () => ({
      labels: ["Easy", "Hard"],
      datasets: [
        {
          data: [E, H],
          backgroundColor: [GREEN, RED],
          borderWidth: 0,
          hoverOffset: 0,
        },
      ],
    }),
    [E, H]
  );

  const centerText: Plugin<"doughnut"> = {
    id: "centerText",
    afterDraw(chart) {
      const { ctx, chartArea } = chart;
      const midX = (chartArea.left + chartArea.right) / 2;
      const midY = (chartArea.top + chartArea.bottom) / 2;
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "bold 16px system-ui, -apple-system, Segoe UI, Roboto";
      ctx.fillStyle = "#fff";
      ctx.fillText(`${pctEasy}% / ${pctHard}%`, midX, midY);
      ctx.restore();
    },
  };

  const options: ChartOptions<"doughnut"> = useMemo(
    () => ({
      responsive: true,
      // držíme 1:1, aby donut nikdy nebol „šikmý“
      maintainAspectRatio: true,
      aspectRatio: 1,
      // nech to ide ZĽAVA doprava (kompatibilné s textom 80/20)
      rotation: Math.PI,
      circumference: 2 * Math.PI,
      cutout: "70%",
      plugins: {
        legend: {
          display: true,
          position: "right",
          labels: { usePointStyle: true, pointStyle: "circle" },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const v = Number(ctx.parsed) || 0;
              const tot = T || 1;
              const pct = Math.round((v / tot) * 100);
              return `${ctx.label}: ${Math.round(v)} min (${pct}%)`;
            },
          },
        },
      },
    }),
    [T]
  );

  // text pod grafom – len delta k 80/20
  let balanceNote = "";
  if (T > 0) {
    if (deltaEasy > 0) {
      balanceNote = `Chýba ti ${deltaEasy} min Easy do vyrovnanosti (80/20).`;
    } else if (deltaEasy < 0) {
      balanceNote = `Máš +${Math.abs(deltaEasy)} min Easy oproti vyrovnanosti (80/20).`;
    } else {
      balanceNote = "Si presne na 80/20 ✔";
    }
  }

  return (
    <OpenerWidget
      title={`Posledné ${weeks} týždne – 80/20`}
      onOpenDetail={onOpenTrend}
      // jemná zelená lišta, aby tón korešpondoval s „Easy“
      accent="bg-emerald-600"
    >
      {/* samotný graf – drž malý, konzistentný */}
      <div className="w-full flex items-center justify-between gap-4">
        <div className="mx-auto">
          {/* pevný štvorcový canvas → stabilné renderovanie */}
          <Doughnut
            key={`${E}-${H}`}
            data={data}
            options={options}
            plugins={[centerText]}
            width={160}
            height={160}
          />
        </div>

        {/* legenda (ak by si ju chcel radšej samostatne) – ChartJS už ju kreslí vpravo,
            takže toto netreba; nechávam iba koment pre alternatívu */}
        {/* <div className="text-sm opacity-80 pr-2">
          <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{background: GREEN}} /> Easy</div>
          <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{background: RED}} /> Hard</div>
        </div> */}
      </div>

      {/* hodnoty */}
      <div className="mt-3 text-xs opacity-85">
        Easy: {Math.round(E)} min • Hard: {Math.round(H)} min
      </div>
      {balanceNote && <div className="mt-1 text-xs opacity-70">{balanceNote}</div>}
    </OpenerWidget>
  );
}