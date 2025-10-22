// src/features/widgets/WidgetPareto8020.tsx
"use client";

import { useEffect, useState, useMemo } from "react";
import OpenerWidget from "@/features/widgets/OpenerWidget";
import { API_URL } from "@/shared/config";
import { useUserId } from "@/shared/hooks/useUserId";

type Props = {
  onOpenTrend?: () => void;
  weeks?: 2 | 4 | 8 | 12;
  sport?: string | null;
};

type WidgetResp = {
  success: boolean;
  data?: { easy_min: number; hard_min: number; total_min: number; days: number };
};

const GREEN = "#00E676";
const RED   = "#FF5252";
const TRACK = "rgba(255,255,255,0.08)";

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

  // percentá a odchýlka do vyrovnanosti 80/20 len cez Easy pri rovnakom T
  const easyPct = T ? Math.round((E / T) * 100) : 0;
  const hardPct = Math.max(0, 100 - easyPct);
  const deltaEasy = Math.round(0.8 * T - E);

  // SVG parametre
  const size = 180;           // šírka/výška SVG (px)
  const stroke = 22;          // hrúbka prstenca
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const C = 2 * Math.PI * r;

  // dash pre Easy od začiatku (ľavá strana) a hneď po ňom Hard
  const easyLen = (easyPct / 100) * C;
  const hardLen = (hardPct / 100) * C;

  // začiatok z ĽAVA → rotujeme celý kruh o 180° okolo stredu
  const rotateLeft = `rotate(180 ${cx} ${cy})`;

  // pomocné texty
  const balanceNote = useMemo(() => {
    if (T === 0) return "";
    if (deltaEasy > 0) return `Chýba ti ${deltaEasy} min Easy do vyrovnanosti (80/20).`;
    if (deltaEasy < 0) return `Máš +${Math.abs(deltaEasy)} min Easy oproti vyrovnanosti (80/20).`;
    return "Si presne na 80/20 ✔";
  }, [T, deltaEasy]);

  return (
    <OpenerWidget
      title={`Posledné ${weeks} týždne – 80/20`}
      onOpenDetail={onOpenTrend}
      accent="bg-emerald-600"
    >
      <div className="w-full flex items-center justify-center">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* track */}
          <circle
            cx={cx} cy={cy} r={r}
            stroke={TRACK} strokeWidth={stroke} fill="none"
            transform={rotateLeft}
          />

          {/* Easy oblúk */}
          <circle
            cx={cx} cy={cy} r={r} fill="none"
            stroke={GREEN} strokeWidth={stroke} strokeLinecap="butt"
            strokeDasharray={`${easyLen} ${C - easyLen}`}
            strokeDashoffset={0}
            transform={rotateLeft}
          />

          {/* Hard oblúk – posunieme sa o Easy dĺžku */}
          <circle
            cx={cx} cy={cy} r={r} fill="none"
            stroke={RED} strokeWidth={stroke} strokeLinecap="butt"
            strokeDasharray={`${hardLen} ${C - hardLen}`}
            strokeDashoffset={-easyLen}
            transform={rotateLeft}
          />

          {/* stredový text */}
          <g>
            <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central"
                  fill="#fff" fontSize="18" fontWeight={800}>
              {T ? `${easyPct}% / ${hardPct}%` : `0% / 0%`}
            </text>
          </g>
        </svg>
      </div>

      <div className="mt-3 text-xs opacity-85">
        Easy: {Math.round(E)} min • Hard: {Math.round(H)} min {T ? `• ${Math.round(T)} min spolu` : ""}
      </div>
      {balanceNote && <div className="mt-1 text-xs opacity-70">{balanceNote}</div>}
    </OpenerWidget>
  );
}