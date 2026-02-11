// src/app/shared/components/charts/PieTrend.tsx
"use client";

import { useMemo, type ReactNode } from "react";

export type PieTrendItem = {
  value: number;
  label: string;
  color: string;
};

type Props = {
  items: PieTrendItem[];
  /** Funkcia na formátovanie hodnoty v legende (napr. minúty na "1h 20m" alebo číslo na "500 W") */
  valueFormatter?: (val: number) => ReactNode;
  /** Funkcia alebo string pre stred grafu (ak neuvedené, zobrazí súčet) */
  renderCenter?: (total: number) => ReactNode;
  /** Voliteľná trieda pre wrapper */
  className?: string;
};

// Default formatter ak žiadny nie je poskytnutý
const defaultFormatter = (val: number) => val.toString();

export function PieTrend({
  items,
  valueFormatter = defaultFormatter,
  renderCenter,
  className = "",
}: Props) {
  const data = useMemo(() => {
    // 1. Spočítame total zo všetkých, aj nulových (kvôli konzistencii, hoci nulové nevykreslíme)
    const total = items.reduce((acc, item) => acc + (item.value || 0), 0);

    if (total === 0) return null;

    let accumulatedPct = 0;

    // 2. Mapovanie segmentov pre SVG
    const segments = items
      .map((item) => {
        const val = item.value || 0;
        // Ak je hodnota 0, preskočíme výpočty pre SVG, ale vrátime objekt pre filtráciu
        if (val <= 0) return null;

        const pct = val / total;

        // SVG Circle logic (r ~ 15.9155 => obvod 100)
        const dashArray = `${pct * 100} ${100 - pct * 100}`;
        // Offset posúvame o toľko, koľko sme už vykreslili
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
      .filter((s): s is NonNullable<typeof s> => s !== null); // Zahodíme nulové segmenty

    return { total, segments };
  }, [items]);

  if (!data) {
    // Fallback pre prázdne dáta (môžeš vrátiť null alebo placeholder)
    return null;
  }

  return (
    <div
      className={`flex flex-row items-center gap-6 py-4 justify-center ${className}`}
    >
      {/* 1. CHART (SVG Donut) */}
      <div className="relative w-24 h-24 flex-shrink-0">
        <svg viewBox="0 0 42 42" className="w-full h-full transform -rotate-90">
          {/* Background track */}
          <circle
            cx="21"
            cy="21"
            r="15.9155"
            fill="transparent"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth="5"
          />

          {/* Segments */}
          {data.segments.map((s) => (
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

        {/* Center Content */}
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
        {data.segments.map((s) => (
          <div
            key={s.label}
            className="flex items-center justify-between text-xs"
          >
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
