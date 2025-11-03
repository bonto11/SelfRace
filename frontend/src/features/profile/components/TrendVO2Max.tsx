"use client";

import * as React from "react";
import { Line } from "react-chartjs-2";
import type { ChartData, ChartOptions } from "chart.js";
import { ensureChartJSRegistered } from "@/shared/charts/register";
import { API_URL } from "@/shared/config";
import { useUserId } from "@/shared/hooks/useUserId";
import vo2Ref from "@/data/VO2Max_Ref_RunnersWorld.json";
import { THEME } from "@/shared/theme/tokens";
import LoadingSpinner from "@/shared/components/ui/LoadingSpinner";
import { CARD } from "@/shared/ui/classes";

ensureChartJSRegistered();

type StaticRow = { sex: "M" | "F"; birth_date?: string | null } | null;
type RowBE = { measured_at: string; value_num: number | null };
type Range = { label: string; min: number | null; max: number | null };
type Group = { sex: "M" | "F"; age_min: number; age_max: number; ranges: Range[] };

function hexA(hex: string, a: number) {
  const h = (hex || "#000000").replace("#", "");
  const aa = Math.round(Math.min(Math.max(a, 0), 1) * 255)
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();
  return `#${h}${aa}`;
}
function levelColor(label: string) {
  const l = (label || "").toLowerCase();
  if (l.includes("excellent") || l.includes("elite")) return THEME.chart.excellent;
  if (l.includes("superior")) return THEME.chart.superior;
  if (l.includes("good")) return THEME.chart.good;
  if (l.includes("fair") || l.includes("average")) return THEME.chart.fair;
  if (l.includes("poor")) return THEME.chart.poor;
  return THEME.chart.neutral;
}

export default function TrendVO2Max() {
  const { userId } = useUserId();
  const [loading, setLoading] = React.useState(false);

  const [stat, setStat] = React.useState<StaticRow>(null);
  const [estHist, setEstHist] = React.useState<RowBE[]>([]);
  const [measHist, setMeasHist] = React.useState<RowBE[]>([]);
  const [weeks, setWeeks] = React.useState<4 | 8 | 12>(8);

  React.useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        // static (sex, birth_date)
        const s = await fetch(`${API_URL}/profile/static/${userId}`, { cache: "no-store" }).then(r => r.json()).catch(() => null);
        if (alive && s?.success) setStat(s.data as StaticRow);
        console.debug("[VO2] static ->", s);

        // estimated history
        const e = await fetch(`${API_URL}/profile/metrics/history/${userId}?metric=VO2Max_estimated`, { cache: "no-store" }).then(r => r.json()).catch(() => null);
        const eRows: RowBE[] = e?.success && Array.isArray(e?.data) ? e.data : [];
        if (alive) setEstHist(eRows);
        console.debug("[VO2] estimated len=", eRows.length, "sample=", eRows[0]);

        // measured history
        const m = await fetch(`${API_URL}/profile/metrics/history/${userId}?metric=VO2Max_measured`, { cache: "no-store" }).then(r => r.json()).catch(() => null);
        const mRows: RowBE[] = m?.success && Array.isArray(m?.data) ? m.data : [];
        if (alive) setMeasHist(mRows);
        console.debug("[VO2] measured len=", mRows.length, "sample=", mRows[0]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [userId]);

  // ---- spoločná os dní + single-point fix ----
  const daysLimit = weeks * 7;

  const allDays = React.useMemo(() => {
    const set = new Set<string>();
    for (const r of estHist) if (r?.measured_at) set.add(r.measured_at.slice(0, 10));
    for (const r of measHist) if (r?.measured_at) set.add(r.measured_at.slice(0, 10));
    let arr = Array.from(set).sort();
    // single-series single-point fix: ak spolu vychádza len jeden deň, pridaj +1 deň
    if (arr.length === 1) {
      const d0 = new Date(arr[0]);
      const d1 = new Date(d0.getTime() + 24 * 3600 * 1000);
      arr = [arr[0], d1.toISOString().slice(0, 10)];
    }
    return arr;
  }, [estHist, measHist]);

  const labelsIso = React.useMemo(
    () => (daysLimit > 0 ? allDays.slice(-daysLimit) : allDays),
    [allDays, daysLimit]
  );

  if (!labelsIso.length) {
    console.debug("[VO2] no labels -> empty view");
    return <div className={`${CARD} p-4`}>Žiadne dáta VO₂Max.</div>;
  }

  const estMap = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const r of estHist) if (typeof r?.value_num === "number" && r?.measured_at) m.set(r.measured_at.slice(0, 10), r.value_num);
    return m;
  }, [estHist]);
  const measMap = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const r of measHist) if (typeof r?.value_num === "number" && r?.measured_at) m.set(r.measured_at.slice(0, 10), r.value_num);
    return m;
  }, [measHist]);

  const labels = labelsIso.map(d => new Date(d).toLocaleDateString("sk-SK"));
  const seriesEst  = labelsIso.map(d => estMap.has(d)  ? Number(estMap.get(d))  : NaN);
  const seriesMeas = labelsIso.map(d => measMap.has(d) ? Number(measMap.get(d)) : NaN);

  // pásma podľa veku/pohlavia (ak stat chýba, pásma vynecháme)
  const sex = stat?.sex === "F" ? "F" : "M";
  const birthDate = stat?.birth_date || "";
  const age = birthDate ? Math.floor((Date.now() - new Date(birthDate).getTime()) / (365.25 * 86400 * 1000)) : 0;
  const group = (vo2Ref as Group[]).find(g => g.sex === sex && age >= g.age_min && age <= g.age_max);
  const ranges = (group?.ranges ?? []).map(r => ({ ...r, color: levelColor(r.label) }));
  console.debug("[VO2] union days cnt:", labelsIso.length, "first/last:", labelsIso[0], labelsIso[labelsIso.length - 1]);

  const maxVal = Math.max(
    0,
    ...[...seriesEst, ...seriesMeas].filter(Number.isFinite) as number[],
    ...ranges.map(r => (typeof r.max === "number" ? r.max : 0))
  );
  const suggestedTop = Math.max(60, Math.ceil(maxVal + 1));

  const datasets: ChartData<"line", number[], string>["datasets"] = [
    // vyfarbené pásma
    ...ranges.map((r, i) => ({
      type: "line" as const,
      label: r.label,
      data: labels.map(() => (typeof r.max === "number" ? r.max : suggestedTop)),
      borderColor: hexA(r.color!, 0),
      backgroundColor: hexA(r.color!, 0.18),
      pointRadius: 0,
      borderWidth: 0,
      fill: i === 0 ? "origin" : "-1",
      order: 1,
    })),
    // Primary: estimated
    {
      type: "line" as const,
      label: "VO₂Max (estimated)",
      data: seriesEst,
      borderColor: THEME.chart.linePrimary || "#FFFFFF",
      backgroundColor: THEME.chart.linePrimary || "#FFFFFF",
      pointRadius: 2,
      borderWidth: 2,
      tension: 0.25,
      spanGaps: true,
      order: 2,
    },
    // Secondary: measured (prerušovaná)
    {
      type: "line" as const,
      label: "VO₂Max (measured)",
      data: seriesMeas,
      borderColor: THEME.chart.lineSecondary || "#A0AEC0",
      backgroundColor: THEME.chart.lineSecondary || "#A0AEC0",
      pointRadius: 2,
      borderDash: [6, 4],
      borderWidth: 2,
      tension: 0.25,
      spanGaps: true,
      order: 2,
    },
  ];

  const data: ChartData<"line", number[], string> = { labels, datasets };

  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    elements: { point: { radius: 2, hoverRadius: 5 } },
    plugins: {
      legend: {
        position: THEME.chart.legendPosition,
        labels: { usePointStyle: true, pointStyle: "circle", boxWidth: 6, boxHeight: 6, padding: 8 },
      },
      tooltip: {
        enabled: true,
        backgroundColor: "#0B1220F2",
        borderColor: "#FFFFFF33",
        borderWidth: 1,
        titleColor: "#FFFFFF",
        bodyColor: "#FFFFFF",
        padding: 10,
        usePointStyle: true,
        boxPadding: 4,
        displayColors: true,
        caretSize: 6,
        cornerRadius: 8,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        suggestedMax: suggestedTop,
        grid: { color: THEME.chart.grid },
        ticks: { color: THEME.color.text },
      },
      x: { grid: { color: THEME.chart.gridSoft } },
    },
  };

  return (
    <div className={CARD}>
      <div className="flex items-center justify-between p-3 border-b border-neutral-800">
        <h2 className="text-base md:text-lg font-semibold">Detail – VO₂Max</h2>
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