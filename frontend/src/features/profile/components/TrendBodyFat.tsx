"use client";

import * as React from "react";
import { Line } from "react-chartjs-2";
import type { ChartData, ChartOptions } from "chart.js";
import { ensureChartJSRegistered } from "@/shared/charts/register";
import { API_URL } from "@/shared/config";
import { useUserId } from "@/shared/hooks/useUserId";
import { getBodyFatBands } from "@/shared/utils/bands";
import { THEME } from "@/shared/theme/tokens";
import LoadingSpinner from "@/shared/components/ui/LoadingSpinner";
import { CARD } from "@/shared/ui/classes";

ensureChartJSRegistered();

type StaticProfile = { sex: "M" | "F" };
type MetricsRow  = { updated_at: string; body_fat_pct: number | null };

// #RRGGBB -> #RRGGBBAA
function hexA(hex: string, a: number) {
  const h = hex.replace("#", "");
  const aa = Math.round(Math.min(Math.max(a, 0), 1) * 255)
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();
  return `#${h}${aa}`;
}

// mapovanie textových labelov → THEME.chart.* (tvoje nové kľúče)
function colorForBandLabel(labelRaw: string) {
  const l = (labelRaw || "").toLowerCase();
  if (l.includes("athlete"))  return THEME.chart.athletes;
  if (l.includes("fitness"))  return THEME.chart.fitness;
  if (l.includes("average"))  return THEME.chart.average;
  if (l.includes("essential"))return THEME.chart.essential;
  if (l.includes("obese"))    return THEME.chart.obese;
  return THEME.chart.neutral;
}

export default function TrendBodyFat() {
  const { userId } = useUserId();
  const [loading, setLoading] = React.useState(false);
  const [stat, setStat] = React.useState<StaticProfile | null>(null);
  const [rows, setRows] = React.useState<MetricsRow[]>([]);
  const [weeks, setWeeks] = React.useState<4 | 8 | 12>(12);

  React.useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const s = await fetch(`${API_URL}/profile/static/${userId}`, { cache: "no-store" }).then(r => r.json());
        if (alive && s?.success) setStat(s.data);
        const m = await fetch(`${API_URL}/profile/metrics/history/${userId}`, { cache: "no-store" }).then(r => r.json());
        if (alive && m?.success) setRows(Array.isArray(m.data) ? m.data : []);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [userId]);

  const days = weeks * 7;
  const dataRows = React.useMemo(() => (days > 0 ? rows.slice(-days) : rows), [rows, days]);
  if (!dataRows.length) return <div className={`${CARD} p-4`}>Žiadne dáta Body Fat %.</div>;

  const labels = dataRows.map(r => new Date(r.updated_at).toLocaleDateString("sk-SK"));
  const values = dataRows.map(r => (typeof r.body_fat_pct === "number" ? r.body_fat_pct : NaN));
  const seriesMax = Math.max(0, ...values.filter(n => Number.isFinite(n)) as number[]);

  const bands = stat ? getBodyFatBands(stat.sex) : [];

  const datasets: ChartData<"line", number[], string>["datasets"] = [
    // pásma (vyplnené pozadia)
    ...bands.map((b, i) => {
      const color = colorForBandLabel(b.label || "");
      const yMax = typeof b.max === "number" ? b.max : Math.max(35, Math.ceil(seriesMax + 1));
      return {
        type: "line" as const,
        label: b.label,
        data: labels.map(() => yMax),
        borderColor: hexA(color, 0),
        backgroundColor: hexA(color, 0.18),
        pointRadius: 0,
        borderWidth: 0,
        fill: i === 0 ? "origin" : "-1",
        order: 1,
      };
    }),

    // línia BF
    {
      type: "line" as const,
      label: "Body Fat %",
      data: values,
      borderColor: THEME.chart.linePrimary,
      backgroundColor: THEME.chart.linePrimary,
      pointRadius: 2,
      borderWidth: 2,
      tension: 0.25,
      spanGaps: true,
      order: 2,
    },
  ];

  const data: ChartData<"line", number[], string> = { labels, datasets };
  const suggestedTop = Math.max(35, Math.ceil(seriesMax + 1));

  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: {
        position: THEME.chart.legendPosition,
        labels: { usePointStyle: true, pointStyle: "circle", boxWidth: 6, boxHeight: 6, padding: 8 },
      },
      tooltip: { enabled: true },
    },
    scales: {
      y: {
        beginAtZero: true,
        suggestedMin: 0,
        suggestedMax: suggestedTop,
        grid: { color: THEME.chart.grid },
        ticks: { color: THEME.color.text },
        title: { display: true, text: "%" },
      },
      x: { grid: { color: THEME.chart.gridSoft } },
    },
  };

  return (
    <div className={CARD}>
      <div className="flex items-center justify-between p-3 border-b border-neutral-800">
        <h2 className="text-base md:text-lg font-semibold">Detail – Body Fat %</h2>
        <div className="flex items-center gap-2 text-xs">
          <select
            value={weeks}
            onChange={(e) => setWeeks(Number(e.target.value) as 4 | 8 | 12)}
            className="px-2 py-1 rounded bg-gray-700 text-white"
            aria-label="Lookback"
          >
            <option value={4}>4 týždne</option>
            <option value={8}>8 týždňov</option>
            <option value={12}>12 týždňov</option>
          </select>
        </div>
      </div>

      <div className="p-3">
        <div className="relative" style={{ height: THEME.chart.weeklyHeight }}>
          {loading && (
            <div className="absolute inset-0 grid place-items-center z-10 bg-black/10">
              <LoadingSpinner size="trend" />
            </div>
          )}
          <Line data={data} options={options} />
        </div>
      </div>
    </div>
  );
}