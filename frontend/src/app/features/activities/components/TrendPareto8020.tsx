// src/features/pareto/components/TrendPareto8020.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Chart as LineChart } from "react-chartjs-2";
import type { ChartData, ChartOptions } from "chart.js";

import { ensureChartJSRegistered } from "@/app/shared/charts/register";
import { OPTIONS } from "@/app/shared/charts/optionsActivity";
import { fmtSecondsHMS } from "@/app/shared/utils/time";
import { useUserId } from "@/app/shared/hooks/useUserId";

import {
  SPORT_OPTIONS,
  PARETO_DEFAULT_SET,
  normalizeSport,
  sportsToCSV,
  isInParetoDefault,
} from "@/app/configs/config_sports";

import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import Button from "@/app/shared/ui/components/Button";
import { inputClass } from "@/app/shared/ui";

import {
  CARD,
  SCROLL_X,
  SURFACE_CARD_STYLE,
  PANEL_PAD,
  PANEL_CARD_HEAD,
  PANEL_TITLE,
  PANEL_ACTIONS_INLINE,
  PANEL_INNER_STACK,
} from "@/app/shared/ui/tokens";

import type { ParetoWeekPick, ParetoRow } from "@/app/features/activities/types/pareto";
import { apiFetchParetoTrend } from "@/app/features/activities/api/analytics_activities";

import { appColors } from "@/app/shared/ui/theme/app_colors";

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
    Array.from(PARETO_DEFAULT_SET),
  );

  const sportCsv = useMemo(() => {
    const csv = sportsToCSV(selectedSports);
    // ak je "all", tak backend necháme bez filtra
    return !csv || csv === "all" ? null : csv;
  }, [selectedSports]);

  const [rows, setRows] = useState<ParetoRow[]>([]);
  const [pickedIdx, setPickedIdx] = useState<number | null>(null);

  const _pxPerLabel = OPTIONS.weeklyPxPerLabel;
  const _height = OPTIONS.Height;
  const _legendPos = OPTIONS.legendPosition;

  useEffect(() => {
    if (!userId) return;
    let alive = true;

    (async () => {
      setLoading(true);
      try {
        const data = await apiFetchParetoTrend(userId, lookback, sportCsv);
        if (!alive) return;
        setRows(Array.isArray(data) ? (data as ParetoRow[]) : []);
        setPickedIdx(null);
      } catch (e) {
        console.error("Pareto trend fetch failed:", e);
        if (!alive) return;
        setRows([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [userId, lookback, sportCsv]);

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
          borderColor: appColors.chartLine1,
          backgroundColor: appColors.chartLine1,
          tension: 0.25,
          pointRadius: 2,
          order: 2,
        },
        {
          type: "line",
          label: "Hard %",
          data: rows.map((r) => (Number.isFinite(r.hard_pct) ? r.hard_pct : 0)),
          borderColor: appColors.chartLine2,
          backgroundColor: appColors.chartLine2,
          tension: 0.25,
          pointRadius: 2,
          borderDash: [4, 4],
          order: 2,
        },
        {
          type: "line",
          label: "80% ref",
          data: ref80,
          borderColor: appColors.chartLine1,
          backgroundColor: appColors.chartLine1,
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
          borderColor: appColors.chartLine2,
          backgroundColor: appColors.chartLine2,
          borderWidth: 1,
          pointRadius: 0,
          borderDash: [6, 6],
          yAxisID: "y",
          order: 1,
        },
      ],
    }),
    [rows, labels, ref80, ref20],
  );

  const options: ChartOptions<"line"> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      layout: { padding: { top: 6, right: 8, bottom: 10, left: 10 } },
      plugins: {
        legend: {
          position: _legendPos,
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
              return `Easy ${fmtSecondsHMS(r.easy_min || 0)} • Hard ${fmtSecondsHMS(
                r.hard_min || 0
              )}`;
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          title: { display: true, text: "%" },
          grid: { color: appColors.chartAxis, drawBorder: false },
          ticks: { padding: 6 },
        },
        x: {
          ticks: { maxRotation: 0, padding: 6 },
          grid: { color: appColors.chartAxis, drawBorder: false },
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
    [_legendPos, rows, selectedSports, onPickWeek],
  );

  const minWidth = Math.max(320, Math.round(labels.length * _pxPerLabel));

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
    <div className={`${CARD} relative`} style={SURFACE_CARD_STYLE}>
      {/* HEADER */}
      <div className={[PANEL_PAD, PANEL_INNER_STACK].join(" ")}>
        <div className={PANEL_CARD_HEAD}>
          <h2 className={PANEL_TITLE}>Trend 80/20</h2>

          <div className={PANEL_ACTIONS_INLINE}>
            <select
              className={`${inputClass} h-8 text-xs w-[130px]`}
              value={lookback}
              onChange={(e) =>
                setLookback(Number(e.target.value) as 2 | 4 | 8 | 12)
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

        <div className={PANEL_ACTIONS_INLINE}>
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

      {/* BODY */}
      <div
        className={`${SCROLL_X} min-w-0`}
        style={{ WebkitOverflowScrolling: "touch", contain: "inline-size" }}
      >
        <div className="relative" style={{ height: _height }}>
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