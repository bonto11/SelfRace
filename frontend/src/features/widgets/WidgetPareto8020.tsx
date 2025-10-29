// src/features/widgets/WidgetPareto8020.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import OpenerWidget from "@/features/widgets/OpenerWidget";
import { useActivityData } from "@/features/activity/data/ActivityDataProvider";
import { THEME } from "@/shared/theme/tokens";
import { fmtMinutes } from "@/shared/utils/format";
import { sportsToCSV, normalizeSportList } from "@/configs/config_sports";
import LoadingSpinner from "@/shared/components/icons/LoadingSpinner";

type Props = {
  onOpenTrend?: () => void;
  weeks?: 2 | 4 | 8 | 12;
  /**
   * Môžeš poslať:
   *  - undefined/null => použije sa BE default whitelist
   *  - "all"          => BE default whitelist
   *  - "run" alebo CSV "run,ride" => presný výber športov
   */
  sport?: string | string[] | null;
};

const colEasy80 = THEME.chart.easy80;
const colHard20 = THEME.chart.hard20;
const colTrack = THEME.chart.track;
const colTick = THEME.chart.tick;

export default function WidgetPareto8020({
  onOpenTrend,
  weeks = 2,
  sport = null,
}: Props) {
  const { getParetoWidget } = useActivityData();

  // -> CSV pre BE (alebo null = BE default whitelist)
  const sportParam = useMemo(() => {
    if (sport == null) return null;
    if (Array.isArray(sport)) return sportsToCSV(sport);
    const s = String(sport).trim();
    if (!s || s.toLowerCase() === "all") return "all";
    const list = s.split(",").map((x) => x.trim()).filter(Boolean);
    return sportsToCSV(normalizeSportList(list));
  }, [sport]);

  const [loading, setLoading] = useState<boolean>(false);
  const [data, setData] = useState<{
    easy_min: number; hard_min: number; total_min: number; days: number;
  } | null>(null);

  // fetch zo SESSION cez provider (má vlastnú cache)
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const d = await getParetoWidget(7 * weeks, sportParam);
        if (!alive) return;
        setData(d ?? { easy_min: 0, hard_min: 0, total_min: 0, days: 7 * weeks });
        console.debug("[PARETO][widget]", { weeks, sportParam, data: d });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [getParetoWidget, weeks, sportParam]);

  const E = Number(data?.easy_min ?? 0);
  const H = Number(data?.hard_min ?? 0);
  const T = Math.max(0, E + H);

  const easyPct = T ? Math.round((E / T) * 100) : 0;
  const hardPct = 100 - easyPct;
  const deltaEasy = Math.round(0.8 * T - E);

  // --- SVG prstenec ---
  const size = 150;
  const stroke = 22;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const C = 2 * Math.PI * r;
  const easyLen = (easyPct / 100) * C;
  const hardLen = C - easyLen;
  const startAtTop = `rotate(-90 ${cx} ${cy})`;

  // 80/20 tick (20% hard)
  const theta = -Math.PI / 2 + 2 * Math.PI * 0.2;
  const outerR = r + stroke / 2 + 5;
  const innerR = r - stroke / 2 - 5;
  const x1 = cx + outerR * Math.cos(theta);
  const y1 = cy + outerR * Math.sin(theta);
  const x2 = cx + innerR * Math.cos(theta);
  const y2 = cy + innerR * Math.sin(theta);

  const note =
    T === 0
      ? ""
      : deltaEasy > 0
      ? `Chýba ti ${deltaEasy} min Easy do 80/20.`
      : deltaEasy < 0
      ? `Máš +${Math.abs(deltaEasy)} min Easy oproti 80/20.`
      : "Si presne na 80/20 ✔";

  return (
    <OpenerWidget
      title={`Posledné ${weeks} týždne – 80/20`}
      onOpenDetail={onOpenTrend}
      accent="bg-emerald-600"
    >
      {loading ? (
        <div className="grid place-items-center py-6">
          <LoadingSpinner size="widget" />
        </div>
      ) : (
        <>
          <div className="w-full flex items-center justify-center">
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
              <circle cx={cx} cy={cy} r={r} stroke={colTrack} strokeWidth={stroke} fill="none" transform={startAtTop} />
              <circle cx={cx} cy={cy} r={r} fill="none" stroke={colHard20} strokeWidth={stroke}
                      strokeDasharray={`${hardLen} ${C - hardLen}`} strokeDashoffset={0} transform={startAtTop} />
              <circle cx={cx} cy={cy} r={r} fill="none" stroke={colEasy80} strokeWidth={stroke}
                      strokeDasharray={`${easyLen} ${C - easyLen}`} strokeDashoffset={easyLen} transform={startAtTop} />
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={colTick} strokeWidth={6} strokeLinecap="round" />
              <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize="18" fontWeight={800}>
                {T ? `${easyPct}% / ${hardPct}%` : "0% / 0%"}
              </text>
            </svg>
          </div>

          <div className="mt-3 text-xs opacity-85">
            Easy: {fmtMinutes(E)} ({easyPct}%) {'\u00B7'} Hard: {fmtMinutes(H)} ({hardPct}%)
            {T ? <> {'\u00B7'} {fmtMinutes(T)} spolu</> : null}
          </div>
          {note && <div className="mt-1 text-xs opacity-70">{note}</div>}
        </>
      )}
    </OpenerWidget>
  );
}