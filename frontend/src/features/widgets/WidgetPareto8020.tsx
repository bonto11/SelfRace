// src/features/widgets/WidgetPareto8020.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import OpenerWidget from "@/features/widgets/OpenerWidget";
import { API_URL } from "@/shared/config";
import { useUserId } from "@/shared/hooks/useUserId";

type Props = { onOpenTrend?: () => void; weeks?: 2 | 4 | 8 | 12; sport?: string | null; };
type WidgetResp = { success: boolean; data?: { easy_min: number; hard_min: number; total_min: number; days: number } };

const GREEN = "#00E676";
const RED   = "#FF5252";
const TRACK = "rgba(255,255,255,0.08)";
const MARK  = "rgba(255,255,255,0.9)";

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

  const easyPct = T ? Math.round((E / T) * 100) : 0;
  const hardPct = Math.max(0, 100 - easyPct);
  const deltaEasy = Math.round(0.8 * T - E);

  // --- SVG parametre ---
  const size = 180;
  const stroke = 22;
  const r = (size - stroke) / 2;
  const cx = size / 2, cy = size / 2;
  const C = 2 * Math.PI * r;

  const easyLen = (easyPct / 100) * C;
  const hardLen = (hardPct / 100) * C;

  // štart hore (12h), smer kreslenia ostáva default (CW); CCW dosiahneme posunom dashoffsetu
  const startAtTop = `rotate(-90 ${cx} ${cy})`;

  // 80% marker – dlhší “tick” na pozícii konca ideálneho EASY
  const markLen = 14;                 // ⬅️ predĺžený marker
  const markOffset = -(0.8 * C);      // posun po obvode (záporný = “pred” štart)

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
          <circle cx={cx} cy={cy} r={r} stroke={TRACK} strokeWidth={stroke} fill="none" transform={startAtTop} />

          {/* HARD (červený) – zvyšok, necháme na štarte (CW) */}
          <circle
            cx={cx} cy={cy} r={r} fill="none"
            stroke={RED} strokeWidth={stroke} strokeLinecap="butt"
            strokeDasharray={`${hardLen} ${C - hardLen}`}
            strokeDashoffset={0}
            transform={startAtTop}
          />

          {/* EASY (zelený) – PROTISMER od 12h: posun o vlastnú dĺžku */}
          <circle
            cx={cx} cy={cy} r={r} fill="none"
            stroke={GREEN} strokeWidth={stroke} strokeLinecap="butt"
            strokeDasharray={`${easyLen} ${C - easyLen}`}
            strokeDashoffset={easyLen}
            transform={startAtTop}
          />

          {/* 80 % marker – výraznejší */}
          <circle
            cx={cx} cy={cy} r={r} fill="none"
            stroke={MARK} strokeWidth={3} strokeLinecap="round"
            strokeDasharray={`${markLen} ${C - markLen}`}
            strokeDashoffset={markOffset}
            transform={startAtTop}
          />

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