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
  const [E, setE] = useState(0);
  const [H, setH] = useState(0);
  const days = 7 * weeks;

  useEffect(() => {
    (async () => {
      const d = await getParetoWidget(days, sport);
      setE(Number(d?.easy_min ?? 0));
      setH(Number(d?.hard_min ?? 0));
    })();
  }, [days, sport, getParetoWidget]);

  const T = Math.max(0, E + H);
  const easyPct = T ? Math.round((E / T) * 100) : 0;
  const hardPct = Math.max(0, 100 - easyPct);
  const deltaEasy = Math.round(0.8 * T - E);

  // SVG ring
  const size=150, stroke=22, r=(size-stroke)/2, cx=size/2, cy=size/2, C=2*Math.PI*r;
  const easyLen = (easyPct/100)*C;
  const hardLen = (hardPct/100)*C;
  const startAtTop = `rotate(-90 ${cx} ${cy})`;
  // 80/20 tick na PRAVEJ strane
  const theta = -Math.PI/2 + 2*Math.PI*0.20;
  const outerR = r + stroke/2 + 5;
  const innerR = r - stroke/2 - 5;
  const x1 = cx + outerR * Math.cos(theta);
  const y1 = cy + outerR * Math.sin(theta);
  const x2 = cx + innerR * Math.cos(theta);
  const y2 = cy + innerR * Math.sin(theta);

  const note =
    !T ? "" :
    deltaEasy > 0 ? `Chýba ti ${deltaEasy} min Easy do vyrovnanosti (80/20).` :
    deltaEasy < 0 ? `Máš +${Math.abs(deltaEasy)} min Easy oproti vyrovnanosti (80/20).` :
    "Si presne na 80/20 ✔";

  return (
    <OpenerWidget title={`Posledné ${weeks} týždne – 80/20`} onOpenDetail={onOpenTrend} accent="bg-emerald-600">
      <div className="w-full flex items-center justify-center">
        <svg width={150} height={150} viewBox="0 0 150 150">
          <circle cx={cx} cy={cy} r={r} stroke={colTrack} strokeWidth={stroke} fill="none" transform={startAtTop}/>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={colHard20} strokeWidth={stroke}
                  strokeDasharray={`${hardLen} ${C-hardLen}`} strokeDashoffset={0} transform={startAtTop}/>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={colEasy80} strokeWidth={stroke}
                  strokeDasharray={`${easyLen} ${C-easyLen}`} strokeDashoffset={easyLen} transform={startAtTop}/>
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