// src/features/widgets/WidgetPareto8020.tsx
"use client";

import { useEffect, useState } from "react";
import OpenerWidget from "@/features/widgets/OpenerWidget";
import { API_URL } from "@/shared/config";
import { useUserId } from "@/shared/hooks/useUserId";
import { THEME } from "@/shared/theme/tokens";

type Props = { onOpenTrend?: () => void; weeks?: 2 | 4 | 8 | 12; sport?: string | null };
type WidgetResp = { success: boolean; data?: { easy_min: number; hard_min: number; total_min: number; days: number } };

const colEasy80 = THEME.chart.easy80;
const colHard20   = THEME.chart.hard20;
const colTrack = THEME.chart.track;
const colTick  = THEME.chart.tick;

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

  const easyPct = T ? Math.round((E / T) * 100) : 0;
  const hardPct = Math.max(0, 100 - easyPct);
  const deltaEasy = Math.round(0.8 * T - E);

  // --- SVG ring parametre ---
  const size = 180;            // plátno
  const stroke = 22;           // hrúbka prstenca
  const r = (size - stroke) / 2;
  const cx = size / 2, cy = size / 2;
  const C = 2 * Math.PI * r;

  // dĺžky oblúkov
  const easyLen = (easyPct / 100) * C;
  const hardLen = (hardPct / 100) * C;

  // začíname hore (12:00)
  const startAtTop = `rotate(-90 ${cx} ${cy})`;

  // ------ 80/20 tick (na PRAVEJ strane) ------
  // marker = 20 % od 12:00 COUNTER-CLOCKWISE -> uhol od +x osi (SVG) je:
  const theta = -Math.PI / 2 + 2 * Math.PI * 0.20; // 12:00 + 20 % kruhu = pravá strana
  const outerR = r + stroke / 6;   // bod na vonkajšom okraji prstenca
  const innerR = r - stroke / 2 -12;   // a na vnútornom (dlhší, jasný tick)
  const widthTick = 4;
  const x1 = cx + outerR * Math.cos(theta);
  const y1 = cy + outerR * Math.sin(theta);
  const x2 = cx + innerR * Math.cos(theta);
  const y2 = cy + innerR * Math.sin(theta);

  const balanceNote =
    T === 0 ? "" :
    deltaEasy > 0 ? `Chýba ti ${deltaEasy} min Easy do vyrovnanosti (80/20).` :
    deltaEasy < 0 ? `Máš +${Math.abs(deltaEasy)} min Easy oproti vyrovnanosti (80/20).` :
    "Si presne na 80/20 ✔";

  return (
    <OpenerWidget
      title={`Posledné ${weeks} týždne – 80/20`}
      onOpenDetail={onOpenTrend}
      accent="bg-emerald-600"
    >
      <div className="w-full flex items-center justify-center">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* track */}
          <circle cx={cx} cy={cy} r={r} stroke={colTrack} strokeWidth={stroke} fill="none" transform={startAtTop} />

          {/* HARD (červený) – zvyšok, držíme na 12:00 v smere hodiniek */}
          <circle
            cx={cx} cy={cy} r={r} fill="none"
            stroke={colHard20} strokeWidth={stroke}
            strokeDasharray={`${hardLen} ${C - hardLen}`}
            strokeDashoffset={0}
            transform={startAtTop}
          />

          {/* EASY (zelený) – ide PROTI smeru (dashoffset = vlastná dĺžka) */}
          <circle
            cx={cx} cy={cy} r={r} fill="none"
            stroke={colEasy80} strokeWidth={stroke}
            strokeDasharray={`${easyLen} ${C - easyLen}`}
            strokeDashoffset={easyLen}
            transform={startAtTop}
          />

          {/* 80/20 hranica – RADIALNY tick na PRAVEJ strane */}
          <line x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={colTick} strokeWidth={widthTick} strokeLinecap="round" />

          {/* stredový text */}
          <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central"
                fill="#fff" fontSize="18" fontWeight={800}>
            {T ? `${easyPct}% / ${hardPct}%` : `0% / 0%`}
          </text>
        </svg>
      </div>

      <div className="mt-3 text-xs opacity-85">
        Easy: {Math.round(E)} min • Hard: {Math.round(H)} min {T ? `• ${Math.round(T)} min spolu` : ""}
      </div>
      {balanceNote && <div className="mt-1 text-xs opacity-70">{balanceNote}</div>}
    </OpenerWidget>
  );
}