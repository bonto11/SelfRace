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
  valueFormatter?: (val: number) => ReactNode;
  renderCenter?: (total: number) => ReactNode;
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

      {/* 2. LEGEND (Upravený layout pre lepšie čítanie percent) */}
      <div className="flex flex-col gap-3 min-w-[140px] w-full max-w-[180px]">
        {data.segments.map((s: any) => (
          <div key={s.label} className="flex items-center w-full">
            
            {/* Ľavá strana: Bodka + 93% + Ľahké */}
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full shadow-sm flex-shrink-0"
                style={{ backgroundColor: s.color }}
              />
              <span className="font-bold text-base leading-none">
                {Math.round(s.pct * 100)}%
              </span>
              <span className="opacity-90 text-sm font-medium leading-none">
                {s.label}
              </span>
            </div>

            {/* Pravá strana: Čas posunutý doprava */}
            <div className="ml-auto flex items-center gap-3 opacity-60 text-xs font-mono pt-0.5">
              <span>{valueFormatter(s.val)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
