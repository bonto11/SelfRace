// src/features/pareto/components/TrendPareto8020.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Chart as LineChart } from "react-chartjs-2";
import type { ChartData, ChartOptions } from "chart.js";
import { ensureChartJSRegistered } from "@/app/shared/charts/register";
import { THEME } from "@/app/shared/theme/tokens";
import { fmtSecondsHMS } from "@/app/shared/utils/time";
import { API_URL } from "@/app/shared/config";
import { useUserId } from "@/app/shared/hooks/useUserId";
import {
  SPORT_OPTIONS,
  PARETO_DEFAULT_SET,
  normalizeSport,
  sportsToCSV,
  isInParetoDefault,
} from "@/app/configs/config_sports";

import LoadingSpinner from "@/app/shared/components/ui/LoadingSpinner";
import Button from "@/app/shared/components/ui/Button";
import { inputClass } from "@/app/shared/ui";
import { SCROLL_X, CARD } from "@/app/shared/ui/tokens";
import {
  ParetoWeekPick,
  ParetoRow,
} from "@/app/features/activities/types/pareto";

ensureChartJSRegistered();

export default function TrendPareto8020({
  onPickWeek,
}: {
  onPickWeek?: (w: ParetoWeekPick) => void;
}) {
  const { userId } = useUserId();
  const [lookback, setLookback] = useState<2 | 4 | 8 | 12>(2);
  const [loading, setLoading] = useState(false);

  const [selectedSports, setSelectedSports] = useState<string[]>(
    Array.from(PARETO_DEFAULT_SET)
  );
  const sportParam = useMemo(
    () => sportsToCSV(selectedSports),
    [selectedSports]
  );

  const [rows, setRows] = useState<ParetoRow[]>([]);
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
        const data: ParetoRow[] = Array.isArray(json?.data) ? json.data : [];
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
        {
          type: "line",
          label: "80% ref",
          data: ref80,
          borderColor: THEME.chart.ref80,
          backgroundColor: THEME.chart.ref80,
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
          borderColor: THEME.chart.ref20,
          backgroundColor: THEME.chart.ref20,
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
      interaction: { mode: "index", intersect: false },
      // malé vnútorné rezervy iba pre osi/legendu, nie „vzduch“ okolo
      layout: { padding: { top: 6, right: 8, bottom: 10, left: 10 } },
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
          padding: 8,
          callbacks: {
            label: (ctx) =>
              `${ctx.dataset.label}: ${Number(ctx.parsed.y ?? 0).toFixed(1)}%`,
            footer: (items) => {
              const i = items?.[0]?.dataIndex ?? 0;
              const r = rows[i];
              if (!r) return "";
              return `Easy ${fmtSecondsHMS(
                r.easy_min || 0
              )} • Hard ${fmtSecondsHMS(r.hard_min || 0)}`;
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          title: { display: true, text: "%" },
          grid: { color: THEME.chart.grid, drawBorder: false },
          ticks: { padding: 6 },
        },
        x: {
          ticks: { maxRotation: 0, padding: 6 },
          grid: { color: THEME.chart.gridSoft, drawBorder: false },
        },
      },
      onClick: (_evt, elements) => {
        const idx = elements?.[0]?.index;
        if (idx == null) return;
        setPickedIdx(idx);
        const r = rows[idx];
        if (!r) return;
        onPickWeek?.({
          start: r.start,
          end: r.end,
          sport: sportsToCSV(selectedSports),
        });
      },
    }),
    [rows, selectedSports, onPickWeek]
  );

  // rovnaký scroll pattern ako TrendWeeklyLoad
  const minWidth = Math.max(
    320,
    Math.round(labels.length * THEME.chart.weeklyPxPerLabel)
  );
  const heightPx = THEME.chart.weeklyHeightCompact ?? 200;

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
    if (selectedSports.length === 0)
      setSelectedSports(Array.from(PARETO_DEFAULT_SET));
  }, [selectedSports.length]);

  return (
    <div className={`${CARD} relative`}>
      {/* HEADER (má štandardný padding) */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold">Trend 80/20</h2>
          <div className="ml-auto">
            <select
              className={`${inputClass} h-8 text-xs w-[130px]`}
              value={lookback}
              onChange={(e) =>
                setLookback(Number(e.target.value) as 4 | 8 | 12)
              }
              title="Lookback"
            >
              <option value={2}>2 týždne</option>
              <option value={4}>4 týždne</option>
              <option value={8}>8 týždňov</option>
              <option value={12}>12 týždňov</option>
            </select>
          </div>
        </div>

        {/* športový multi-select */}
        <div className="mt-2 flex flex-wrap gap-2">
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
      </div>

      {/* BODY (graf) – bez paddingu, full-width, so scrollom) */}
      <div
        className={`${SCROLL_X} min-w-0`}
        style={{ WebkitOverflowScrolling: "touch", contain: "inline-size" }}
      >
        <div className="relative" style={{ height: heightPx }}>
          {loading && (
            <div className="absolute inset-0 grid place-items-center z-10 bg-black/10">
              <LoadingSpinner size="trend" />
            </div>
          )}
          <div style={{ minWidth, height: "100%", maxWidth: "none" }}>
            <LineChart type="line" data={data} options={options} />
          </div>
        </div>
      </div>
    </div>
  );
}
