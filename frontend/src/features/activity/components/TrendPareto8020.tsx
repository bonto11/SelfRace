// src/features/pareto/components/TrendPareto8020.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Chart as LineChart } from "react-chartjs-2";
import type { ChartData, ChartOptions } from "chart.js";
import { ensureChartJSRegistered } from "@/shared/charts/register";
import { THEME } from "@/shared/theme/tokens";
import { fmtSecondsHMS } from "@/shared/utils/format";
import { API_URL } from "@/shared/config";
import { useUserId } from "@/shared/hooks/useUserId";
import {
  SPORT_OPTIONS,
  PARETO_DEFAULT_SET,
  normalizeSport,
  sportsToCSV,
  isInParetoDefault,
} from "@/configs/config_sports";

import LoadingSpinner from "@/shared/components/ui/LoadingSpinner";
import Button from "@/shared/components/ui/Button";
import { WIDGET_CARD, SECTION_WIDE } from "@/shared/ui/classes";
import { inputClass } from "@/shared/ui";

ensureChartJSRegistered();

export type ParetoWeekPick = { start?: string; end?: string; sport: string };

type Row = {
  label: string;
  easy_min: number;
  hard_min: number;
  easy_pct: number;
  hard_pct: number;
  start?: string;
  end?: string;
};

export default function TrendPareto8020({ onPickWeek }: { onPickWeek?: (w: ParetoWeekPick) => void }) {
  const { userId } = useUserId();
  const [lookback, setLookback] = useState<4 | 8 | 12>(4);
  const [loading, setLoading] = useState(false);

  const [selectedSports, setSelectedSports] = useState<string[]>(
    Array.from(PARETO_DEFAULT_SET)
  );

  const sportParam = useMemo(() => sportsToCSV(selectedSports), [selectedSports]);
  const [rows, setRows] = useState<Row[]>([]);
  const [pickedIdx, setPickedIdx] = useState<number | null>(null);

  useEffect(() => {
    if (!userId) return;
    let alive = true;

    setLoading(true);
    const q = new URLSearchParams({ weeks: String(lookback) });
    q.set("sport", sportParam && sportParam !== "all" ? sportParam : "all");
    const url = `${API_URL}/analytics/pareto8020/${userId}?${q.toString()}`;

    (async () => {
      try {
        const res = await fetch(url, { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        const data: Row[] = Array.isArray(json?.data) ? json.data : [];
        if (!alive) return;
        setRows(data);
        setPickedIdx(null);
      } catch {
        if (!alive) return;
        setRows([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [userId, lookback, sportParam]);

  const labels = useMemo(() => rows.map((r) => r.label), [rows]);
  const ref80 = useMemo(() => Array(labels.length).fill(80), [labels.length]);
  const ref20 = useMemo(() => Array(labels.length).fill(20), [labels.length]);

  const data: ChartData<"line", number[], string> = useMemo(
    () => ({
      labels,
      datasets: [
        {
          type: "line",
          label: "Easy %",
          data: rows.map((r) => (Number.isFinite(r.easy_pct) ? r.easy_pct : 0)),
          borderColor: THEME.chart.easy80,
          backgroundColor: THEME.chart.easy80,
          tension: 0.25,
          pointRadius: 2,
          order: 2,
        },
        {
          type: "line",
          label: "Hard %",
          data: rows.map((r) => (Number.isFinite(r.hard_pct) ? r.hard_pct : 0)),
          borderColor: THEME.chart.hard20,
          backgroundColor: THEME.chart.hard20,
          tension: 0.25,
          pointRadius: 2,
          borderDash: [4, 4],
          order: 2,
        },
        // referencie
        {
          type: "line",
          label: "80% ref",
          data: ref80,
          borderColor: THEME.chart?.ref80 ?? "rgba(74,222,128,0.35)",
          backgroundColor: THEME.chart?.ref80 ?? "rgba(74,222,128,0.35)",
          borderWidth: 1,
          pointRadius: 0,
          borderDash: [6, 6],
          yAxisID: "y",
          order: 1,
        },
        {
          type: "line",
          label: "20% ref",
          data: ref20,
          borderColor: THEME.chart?.ref20 ?? "rgba(248,113,113,0.35)",
          backgroundColor: THEME.chart?.ref20 ?? "rgba(248,113,113,0.35)",
          borderWidth: 1,
          pointRadius: 0,
          borderDash: [6, 6],
          yAxisID: "y",
          order: 1,
        },
      ],
    }),
    [rows, labels, ref80, ref20]
  );

  const options: ChartOptions<"line"> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        // jemný vnútorný padding grafu, aby sa body/legendy „nedotýkali” okrajov
        padding: 12,
      },
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          position: THEME.chart.legendPosition,
          labels: {
            usePointStyle: true,
            pointStyle: "circle",
            padding: 10,
            boxWidth: 6,
            boxHeight: 6,
          },
        },
        tooltip: {
          callbacks: {
            label: (ctx) =>
              `${ctx.dataset.label}: ${Number(ctx.parsed.y ?? 0).toFixed(1)}%`,
            footer: (items) => {
              const i = items?.[0]?.dataIndex ?? 0;
              const r = rows[i];
              if (!r) return "";
              return `Easy ${fmtSecondsHMS(r.easy_min || 0)} • Hard ${fmtSecondsHMS(r.hard_min || 0)}`;
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          title: { display: true, text: "%" },
          ticks: { padding: 6 },
          grid: { color: THEME.chart.grid },
        },
        x: {
          ticks: { maxRotation: 0, padding: 6 },
          grid: { color: THEME.chart.gridSoft },
        },
      },
      onClick: (_evt, elements) => {
        const idx = elements?.[0]?.index;
        if (idx == null) return;
        setPickedIdx(idx);
        const r = rows[idx];
        if (!r) return;
        const csv = sportsToCSV(selectedSports);
        onPickWeek?.({ start: r.start, end: r.end, sport: csv });
      },
    }),
    [rows, selectedSports, onPickWeek]
  );

  const minWidth = Math.max(360, Math.round(labels.length * THEME.chart.weeklyPxPerLabel));
  const picked = pickedIdx != null ? rows[pickedIdx] : null;

  const toggleSport = (s: string) => {
    const n = normalizeSport(s);
    if (!n || n === "all") return;
    setPickedIdx(null);
    setSelectedSports((prev) => {
      const set = new Set(prev.map(normalizeSport).filter(Boolean) as string[]);
      set.has(n) ? set.delete(n) : set.add(n);
      return Array.from(set);
    });
  };

  useEffect(() => {
    if (selectedSports.length === 0) {
      setSelectedSports(Array.from(PARETO_DEFAULT_SET));
    }
  }, [selectedSports.length]);

  return (
    <div className={`${WIDGET_CARD} relative`}>
      {/* header */}
      <div className="flex items-center gap-2 mb-2">
        <h2 className="text-lg font-bold">Trend 80/20</h2>
        <div className="ml-auto flex items-center gap-2">
          <select
            className={`${inputClass} h-8 text-xs w-[130px]`}
            value={lookback}
            onChange={(e) => setLookback(Number(e.target.value) as 4 | 8 | 12)}
            title="Lookback"
          >
            <option value={4}>4 týždne</option>
            <option value={8}>8 týždňov</option>
            <option value={12}>12 týždňov</option>
          </select>
        </div>
      </div>

      {/* športový multi-select */}
      <div className="flex flex-wrap gap-2 mb-3">
        {SPORT_OPTIONS.map((opt) => {
          const norm = normalizeSport(opt.value) ?? "";
          const active = selectedSports.map(normalizeSport).includes(norm);
          const isDefault = isInParetoDefault(norm);

          return (
            <Button
              key={opt.value}
              size="xs"
              variant={active ? "secondary" : "ghost"}
              onClick={() => toggleSport(opt.value)}
              title={isDefault ? "V default 80/20" : "Mimo default 80/20"}
            >
              {opt.label}
              {isDefault ? "" : " *"}
            </Button>
          );
        })}
      </div>

      {/* graf – vlastný sekčný podklad + padding, aby nič neležalo na okrajoch */}
      <div className={`${SECTION_WIDE} overflow-x-auto`} style={{ WebkitOverflowScrolling: "touch" }}>
        <div style={{ height: 260 }}>
          {loading ? (
            <div className="w-full h-full flex items-center justify-center">
              <LoadingSpinner size="trend" />
            </div>
          ) : (
            <div style={{ minWidth, height: "100%", maxWidth: "none" }}>
              <LineChart type="line" data={data} options={options} />
            </div>
          )}
        </div>
      </div>

      {/* detail vybraného týždňa */}
      <div className="mt-2 text-xs opacity-80">
        {picked ? (
          <>
            <div className="font-semibold">{picked.label}</div>
            <div>
              Easy: {fmtSecondsHMS(picked.easy_min || 0)} ({Math.round(picked.easy_pct)}%) {" • "}
              Hard: {fmtSecondsHMS(picked.hard_min || 0)} ({Math.round(picked.hard_pct)}%)
            </div>
          </>
        ) : (
          <div>Klikni na bod v grafe pre detail týždňa.</div>
        )}
      </div>
    </div>
  );
}