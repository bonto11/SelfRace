// src/app/shared/components/trend/PieTrend.tsx
"use client";

import { useMemo, type ReactNode } from "react";
import { useT } from "@/app/shared/i18n/useT";

export type PieTrendItem = {
  value: number;
  label: string;
  color: string;
};

type Props = {
  items: PieTrendItem[];
  /** Funkcia na formátovanie hodnoty v legende (napr. minúty na "1h 20m") */
  valueFormatter?: (val: number) => ReactNode;
  /** Funkcia alebo string pre stred grafu (ak neuvedené, zobrazí súčet) */
  renderCenter?: (total: number) => ReactNode;
  /** Voliteľná trieda pre wrapper */
  className?: string;
};

const defaultFormatter = (val: number) => val.toString();

export function PieTrend({
  items,
  valueFormatter = defaultFormatter,
  renderCenter,
  className = "",
}: Props) {
  const t = useT();
  
  const data = useMemo(() => {
    const total = items.reduce((acc, item) => acc + (item.value || 0), 0);
    if (total === 0) return null;

    let accumulatedPct = 0;

    const segments = items
      .map((item) => {
        const val = item.value || 0;
        if (val <= 0) return null;

        const pct = val / total;
        const dashArray = `${pct * 100} ${100 - pct * 100}`;
        const offset = 25 - accumulatedPct * 100;

        accumulatedPct += pct;

        return {
          ...item,
          val,
          pct,
          dashArray,
          offset,
        };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null);

    return { total, segments };
  }, [items]);

  if (!data) {
    return (
      <div className="py-4 text-center text-xs opacity-50 italic">
        {t("charts.pie.noData" as any)}
      </div>
    );
  }

  return (
    <div className={`flex flex-row items-center gap-6 py-4 justify-center ${className}`}>
      {/* 1. CHART (SVG Donut) */}
      <div className="relative w-24 h-24 flex-shrink-0">
        <svg viewBox="0 0 42 42" className="w-full h-full transform -rotate-90">
          <circle
            cx="21"
            cy="21"
            r="15.9155"
            fill="transparent"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth="5"
          />
          {data.segments.map((s: any) => (
            <circle
              key={s.label}
              cx="21"
              cy="21"
              r="15.9155"
              fill="transparent"
              stroke={s.color}
              strokeWidth="5"
              strokeDasharray={s.dashArray}
              strokeDashoffset={-(100 - s.offset)}
              className="transition-all duration-500 ease-out"
            />
          ))}
        </svg>

        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-[10px] font-bold opacity-80">
            {renderCenter
              ? renderCenter(data.total)
              : valueFormatter(data.total)}
          </span>
        </div>
      </div>

      {/* 2. LEGEND */}
      <div className="flex flex-col gap-1 min-w-[120px]">
        {data.segments.map((s: any) => (
          <div key={s.label} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full shadow-sm"
                style={{ backgroundColor: s.color }}
              />
              <span className="opacity-70 font-medium">{s.label}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono opacity-90">
                {valueFormatter(s.val)}
              </span>
              <span className="font-mono text-[10px] opacity-50 w-8 text-right">
                {Math.round(s.pct * 100)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}