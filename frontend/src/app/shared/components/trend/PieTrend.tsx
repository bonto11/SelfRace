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
    <div className={`flex flex-row items-center gap-5 py-4 px-2 justify-center w-full ${className}`}>
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
          <span className="text-[10px] font-bold opacity-80 text-center leading-tight">
            {renderCenter
              ? renderCenter(data.total)
              : valueFormatter(data.total)}
          </span>
        </div>
      </div>

      {/* 2. LEGEND (Zarovnaný layout s fixnými šírkami) */}
      <div className="flex flex-col gap-3 flex-1 max-w-[200px]">
        {data.segments.map((s: any) => (
          <div key={s.label} className="flex items-center w-full">
            
            {/* Bodka */}
            <span
              className="w-2.5 h-2.5 rounded-full shadow-sm flex-shrink-0 mr-2.5"
              style={{ backgroundColor: s.color }}
            />

            {/* Percentá: pevná šírka (w-9), zarovnané doprava, aby % boli pekne pod sebou */}
            <span className="font-bold text-[15px] leading-none w-9 text-right shrink-0">
              {Math.round(s.pct * 100)}%
            </span>

            {/* Názov zóny: fixné odsadenie zľava (ml-3), zaberie len toľko miesta, koľko potrebuje */}
            <span className="opacity-90 text-[13px] font-medium leading-none ml-3">
              {s.label}
            </span>

            {/* Čas: 'ml-auto' ho odtlačí úplne vpravo a 'min-w' zaistí pravé zarovnanie stĺpca */}
            <span className="ml-auto opacity-60 text-xs font-mono text-right shrink-0 pl-2 pt-0.5 min-w-[50px]">
              {valueFormatter(s.val)}
            </span>
            
          </div>
        ))}
      </div>
    </div>
  );
}
