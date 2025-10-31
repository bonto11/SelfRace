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
  normalizeSportList,
  sportsToCSV,
  isInParetoDefault,
} from "@/configs/config_sports";

import LoadingSpinner from "@/shared/components/ui/LoadingSpinner";

ensureChartJSRegistered();

export type ParetoWeekPick = { start?: string; end?: string; sport: string }; // sport = CSV alebo "all"

type Row = {
  label: string;
  easy_min: number;
  hard_min: number;
  easy_pct: number;
  hard_pct: number;
  start?: string;
  end?: string;
};

export default function TrendPareto8020({
  onPickWeek,
}: {
  onPickWeek?: (w: ParetoWeekPick) => void;
}) {
  const { userId } = useUserId();
  const [lookback, setLookback] = useState<4 | 8 | 12>(4);
  const [loading, setLoading] = useState(false);

  // multi-select športov; default = BE default whitelist
  const [selectedSports, setSelectedSports] = useState<string[]>(
    Array.from(PARETO_DEFAULT_SET)
  );

  // odvodený param pre BE
  const sportParam = useMemo(
    () => sportsToCSV(selectedSports),
    [selectedSports]
  );

  const [rows, setRows] = useState<Row[]>([]);
  const [pickedIdx, setPickedIdx] = useState<number | null>(null);

  // fetch priamo z BE (bez Provider/SESSION)
  useEffect(() => {
    if (!userId) return;
    let alive = true;

    setLoading(true);
    const q = new URLSearchParams({ weeks: String(lookback) });
    if (sportParam && sportParam !== "all") q.set("sport", sportParam);
    else q.set("sport", "all");

    const url = `${API_URL}/analytics/pareto8020/${userId}?${q.toString()}`;
    console.debug("[PARETO][fetch] ->", {
      url,
      lookback,
      selectedSports,
      sportParam,
    });

    (async () => {
      try {
        const res = await fetch(url, { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        const data: Row[] = Array.isArray(json?.data) ? json.data : [];
        if (!alive) return;
        setRows(data);
        setPickedIdx(null);
        setLoading(false);
        console.debug("[PARETO][fetch][ok]", {
          count: data.length,
          sample: data[0],
        });
      } catch (e) {
        setLoading(false);
        console.error("[PARETO][fetch][err]", e);
        if (!alive) return;
        setRows([]);
      }
    })();

    return () => {
      alive = false;
    };
  }, [userId, lookback, sportParam, selectedSports]);

  const labels = useMemo(() => rows.map((r) => r.label), [rows]);

  // referenčné čiary 80/20
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
        // referenčné čiary
        {
          type: "line" as const,
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
          type: "line" as const,
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
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          position: THEME.chart.legendPosition,
          labels: {
            usePointStyle: true,
            pointStyle: "circle",
            padding: 8,
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
          grid: { color: THEME.chart.grid },
        },
        x: { ticks: { maxRotation: 0 }, grid: { color: THEME.chart.gridSoft } },
      },
      onClick: (_evt, elements) => {
        const idx = elements?.[0]?.index;
        if (idx == null) return;
        setPickedIdx(idx);
        const r = rows[idx];
        if (r) {
          const csv = sportsToCSV(selectedSports);
          onPickWeek?.({ start: r.start, end: r.end, sport: csv });
          console.debug("[PARETO][pick]", { idx, csv, row: r });
        }
      },
    }),
    [rows, selectedSports, onPickWeek]
  );

  const minWidth = Math.max(
    360,
    Math.round(labels.length * THEME.chart.weeklyPxPerLabel)
  );
  const picked = pickedIdx != null ? rows[pickedIdx] : null;

  // --- UI: jednoduchý multi-select (checkboxy) ---
  const toggleSport = (s: string) => {
    const n = normalizeSport(s);
    if (!n || n === "all") return;
    setPickedIdx(null);
    setSelectedSports((prev) => {
      const set = new Set(prev.map(normalizeSport).filter(Boolean) as string[]);
      if (set.has(n)) set.delete(n);
      else set.add(n);
      const next = Array.from(set);
      console.debug("[PARETO][sports][toggle]", { click: s, norm: n, next });
      return next;
    });
  };

  // predvyplniť default whitelisted športy, keď by si user vyprázdnil výber
  useEffect(() => {
    if (selectedSports.length === 0) {
      setSelectedSports(Array.from(PARETO_DEFAULT_SET));
      console.debug(
        "[PARETO][sports][reset->default]",
        Array.from(PARETO_DEFAULT_SET)
      );
    }
  }, [selectedSports.length]);

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded shadow">
      {/* header */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <h2 className="text-sm font-semibold opacity-80">Trend 80/20</h2>

        <div className="flex items-center gap-2 text-xs">
          <select
            className="px-2 py-1 rounded bg-gray-700 text-white"
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

      {/* multi-select športov */}
      <div className="flex flex-wrap gap-2 mb-3">
        {SPORT_OPTIONS.map((opt) => {
          const val = normalizeSport(opt.value) ?? "";
          const active = selectedSports.map(normalizeSport).includes(val);
          const isDefault = isInParetoDefault(val);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggleSport(opt.value)}
              className={`px-2 py-1 rounded text-xs border ${
                active
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-gray-700 text-white/90 border-gray-600"
              }`}
              title={isDefault ? "V default 80/20" : "Mimo default 80/20"}
            >
              {opt.label}
              {isDefault ? "" : " *"}
            </button>
          );
        })}
      </div>

      {/* graf */}
      <div
        className="overflow-x-auto rounded-md"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <div style={{ height: 240 }}>
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
              Easy: {fmtSecondsHMS(picked.easy_min || 0)} (
              {Math.round(picked.easy_pct)}%) {" • "}
              Hard: {fmtSecondsHMS(picked.hard_min || 0)} (
              {Math.round(picked.hard_pct)}%)
            </div>
          </>
        ) : (
          <div>Klikni na bod v grafe pre detail týždňa.</div>
        )}
      </div>
    </div>
  );
}
