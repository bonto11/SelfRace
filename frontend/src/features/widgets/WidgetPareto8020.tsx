// src/features/widgets/WidgetPareto8020.tsx
"use client";

import { useEffect, useState } from "react";
import OpenerWidget from "@/features/widgets/OpenerWidget";
import { useActivityData } from "@/features/activity/data/ActivityDataProvider";
import { THEME } from "@/shared/theme/tokens";

type Props = { onOpenTrend?: () => void; weeks?: 2 | 4 | 8 | 12; sport?: string | null };

const colEasy80 = THEME.chart.easy80;
const colHard20 = THEME.chart.hard20;
const colTrack  = THEME.chart.track;
const colTick   = THEME.chart.tick;

export default function WidgetPareto8020({ onOpenTrend, weeks = 2, sport = null }: Props) {
  const { getParetoWidget } = useActivityData();
  const [data, setData] = useState<{ easy_min:number; hard_min:number; total_min:number; days:number } | null>(null);

  useEffect(() => {
    (async () => {
      const d = await getParetoWidget(7 * weeks, sport);
      setData(d ?? { easy_min:0, hard_min:0, total_min:0, days:7*weeks });
    })();
  }, [getParetoWidget, weeks, sport]);

  const E = Number(data?.easy_min ?? 0);
  const H = Number(data?.hard_min ?? 0);
  const T = Math.max(0, E + H);

  const easyPct = T ? Math.round((E / T) * 100) : 0;
  const hardPct = 100 - easyPct;
  const deltaEasy = Math.round(0.8 * T - E);

  // --- SVG prstenec ---
  const size = 150, stroke = 22;
  const r = (size - stroke) / 2;
  const cx = size / 2, cy = size / 2;
  const C = 2 * Math.PI * r;
  const easyLen = (easyPct / 100) * C;
  const hardLen = C - easyLen;
  const startAtTop = `rotate(-90 ${cx} ${cy})`;

  // tick 80/20 vpravo
  const theta = -Math.PI / 2 + 2 * Math.PI * 0.20;
  const outerR = r + stroke / 2 + 5;
  const innerR = r - stroke / 2 - 5;
  const x1 = cx + outerR * Math.cos(theta);
  const y1 = cy + outerR * Math.sin(theta);
  const x2 = cx + innerR * Math.cos(theta);
  const y2 = cy + innerR * Math.sin(theta);

  const note =
    T === 0 ? "" :
    deltaEasy > 0 ? `Chýba ti ${deltaEasy} min Easy do vyrovnanosti (80/20).` :
    deltaEasy < 0 ? `Máš +${Math.abs(deltaEasy)} min Easy oproti vyrovnanosti (80/20).` :
    "Si presne na 80/20 ✔";

  return (
    <OpenerWidget title={`Posledné ${weeks} týždne – 80/20`} onOpenDetail={onOpenTrend} accent="bg-emerald-600">
      <div className="w-full flex items-center justify-center">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={cx} cy={cy} r={r} stroke={colTrack} strokeWidth={stroke} fill="none" transform={startAtTop} />
          <circle cx={cx} cy={cy} r={r} fill="none"
                  stroke={colHard20} strokeWidth={stroke}
                  strokeDasharray={`${hardLen} ${C - hardLen}`} strokeDashoffset={0}
                  transform={startAtTop} />
          <circle cx={cx} cy={cy} r={r} fill="none"
                  stroke={colEasy80} strokeWidth={stroke}
                  strokeDasharray={`${easyLen} ${C - easyLen}`} strokeDashoffset={easyLen}
                  transform={startAtTop} />
          <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={colTick} strokeWidth={6} strokeLinecap="round" />
          <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize="18" fontWeight={800}>
            {T ? `${easyPct}% / ${hardPct}%` : "0% / 0%"}
          </text>
        </svg>
      </div>

      <div className="mt-3 text-xs opacity-85">
        Easy: {Math.round(E)} min • Hard: {Math.round(H)} min {T ? `• ${Math.round(T)} min spolu` : ""}
      </div>
      {note && <div className="mt-1 text-xs opacity-70">{note}</div>}
    </OpenerWidget>
  );
}