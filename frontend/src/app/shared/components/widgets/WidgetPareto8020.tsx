// src/features/widgets/WidgetPareto8020.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import { useActivityData } from "@/app/shared/components/dataProviders/ActivityDataProvider";
import { THEME } from "@/app/shared/theme/tokens";
import { fmtMinutes } from "@/app/shared/utils/time";
import { sportsToCSV, normalizeSportList } from "@/app/configs/config_sports";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { appColors } from "@/app/shared/theme/app_colors";
import {
  WIDGET_LOADING_WRAP,
  WIDGET_CENTER,
  WIDGET_FOOTNOTE,
  WIDGET_NOTE,
} from "@/app/shared/ui/tokens";

type Props = {
  onOpenTrend?: () => void;
  weeks?: 2 | 4 | 8 | 12;
  sport?: string | string[] | null;
};

export default function WidgetPareto8020({
  onOpenTrend,
  weeks = 2,
  sport = null,
}: Props) {
  const { getParetoWidget } = useActivityData();

  const sportParam = useMemo(() => {
    if (sport == null) return null;
    if (Array.isArray(sport)) return sportsToCSV(sport);
    const s = String(sport).trim();
    if (!s || s.toLowerCase() === "all") return "all";
    const list = s
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    return sportsToCSV(normalizeSportList(list));
  }, [sport]);

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{
    easy_min: number;
    hard_min: number;
    total_min: number;
    days: number;
  } | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const d = await getParetoWidget(7 * weeks, sportParam);
        if (!alive) return;
        setData(
          d ?? { easy_min: 0, hard_min: 0, total_min: 0, days: 7 * weeks }
        );
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [getParetoWidget, weeks, sportParam]);

  const E = Math.max(0, Number(data?.easy_min ?? 0));
  const H = Math.max(0, Number(data?.hard_min ?? 0));
  const T = Math.max(0, E + H);

  const easyPct = T ? Math.round((E / T) * 100) : 0;
  const hardPct = T ? 100 - easyPct : 0;

  const targetEasy = 0.8 * T;
  const deltaEasy = Math.round(targetEasy - E);
  const deviation = T ? Math.abs(E - targetEasy) / T : 1;

  const CH = (THEME as any)?.chart ?? {};

  const accent =
    T === 0
      ? (CH.neutral ?? appColors.textMuted)
      : deviation <= 0.05
        ? (CH.positive ?? CH.fitness ?? appColors.brandPrimary)
        : deviation <= 0.1
          ? (CH.warning ?? CH.average ?? appColors.statusWarning)
          : (CH.obese ?? CH.danger ?? appColors.statusError);

  const note =
    T === 0
      ? ""
      : deltaEasy > 0
        ? `Chýba ti ${deltaEasy} min Easy do 80/20.`
        : deltaEasy < 0
          ? `Máš +${Math.abs(deltaEasy)} min Easy oproti 80/20.`
          : "Si presne na 80/20 ✔";

  // farby prstenca – iba theme/app_colors (bez hardcoded)
  const colEasy80 = CH.easy80 ?? CH.fitness ?? appColors.brandPrimary;
  const colHard20 = CH.hard20 ?? CH.warning ?? appColors.accentTeal;
  const colTrack = CH.track ?? appColors.surfaceCardBorder;
  const colTick = CH.tick ?? appColors.textSecondary;

  const textFill = appColors.textPrimary;

  const size = 150;
  const stroke = 22;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const Cc = 2 * Math.PI * r;
  const easyLen = (easyPct / 100) * Cc;
  const hardLen = Cc - easyLen;
  const startAtTop = `rotate(-90 ${cx} ${cy})`;

  const theta = -Math.PI / 2 + 2 * Math.PI * 0.2;
  const outerR = r + stroke / 2 + 5;
  const innerR = r - stroke / 2 - 5;
  const x1 = cx + outerR * Math.cos(theta);
  const y1 = cy + outerR * Math.sin(theta);
  const x2 = cx + innerR * Math.cos(theta);
  const y2 = cy + innerR * Math.sin(theta);

  return (
    <WidgetCard
      title={`Posledné ${weeks} týždne – 80/20`}
      onOpen={onOpenTrend}
      interactive={!!onOpenTrend}
      accent={accent}
      minH={200}
    >
      {loading ? (
        <div className={WIDGET_LOADING_WRAP}>
          <LoadingSpinner size="widget" />
        </div>
      ) : (
        <>
          <div className={WIDGET_CENTER}>
            <svg
              width={size}
              height={size}
              viewBox={`0 0 ${size} ${size}`}
              role="img"
              aria-label="80/20 prstenec"
            >
              <circle
                cx={cx}
                cy={cy}
                r={r}
                stroke={colTrack}
                strokeWidth={stroke}
                fill="none"
                transform={startAtTop}
              />

              <circle
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke={colHard20}
                strokeWidth={stroke}
                strokeDasharray={`${hardLen} ${Cc - hardLen}`}
                strokeDashoffset={0}
                transform={startAtTop}
              />

              <circle
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke={colEasy80}
                strokeWidth={stroke}
                strokeDasharray={`${easyLen} ${Cc - easyLen}`}
                strokeDashoffset={easyLen}
                transform={startAtTop}
              />

              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={colTick}
                strokeWidth={6}
                strokeLinecap="round"
              />

              <text
                x={cx}
                y={cy}
                textAnchor="middle"
                dominantBaseline="central"
                fill={textFill}
                fontSize="18"
                fontWeight={800}
              >
                {T ? `${easyPct}% / ${hardPct}%` : "0% / 0%"}
              </text>
            </svg>
          </div>

          <div className={WIDGET_FOOTNOTE}>
            Easy: {fmtMinutes(E)} ({easyPct}%){" \u00B7 "}Hard: {fmtMinutes(H)}{" "}
            ({hardPct}%)
            {T ? (
              <>
                {" \u00B7 "}
                {fmtMinutes(T)} spolu
              </>
            ) : null}
          </div>

          {note && <div className={WIDGET_NOTE}>{note}</div>}
        </>
      )}
    </WidgetCard>
  );
}
