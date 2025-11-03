"use client";

import { useEffect, useMemo, useState } from "react";
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

type StaticRow = { sex: "M" | "F"; birth_date?: string | null };
type RowBE = { measured_at: string; value_num: number | null };
type Range = { label: string; min: number | null; max: number | null };
type Group = { sex: "M" | "F"; age_min: number; age_max: number; ranges: Range[] };

// #RRGGBB -> #RRGGBBAA
function hexA(hex: string, a: number) {
  const h = hex.replace("#", "");
  const aa = Math.round(Math.min(Math.max(a, 0), 1) * 255)
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();
  return `#${h}${aa}`;
}

function levelColor(label: string) {
  const l = label.toLowerCase();
  if (l.includes("excellent") || l.includes("elite")) return THEME.chart.excellent;
  if (l.includes("superior")) return THEME.chart.superior;
  if (l.includes("good")) return THEME.chart.good;
  if (l.includes("fair") || l.includes("average")) return THEME.chart.fair;
  if (l.includes("poor")) return THEME.chart.poor;
  return THEME.chart.neutral;
}

export default function TrendVO2Max() {
  const { userId } = useUserId();
  const [loading, setLoading] = useState(false);

  const [sex, setSex] = useState<"M" | "F">("M");
  const [birthDate, setBirthDate] = useState<string>("");

  const [estHist, setEstHist] = useState<RowBE[]>([]);
  const [measHist, setMeasHist] = useState<RowBE[]>([]);

  const [weeks, setWeeks] = useState<4 | 8 | 12>(8);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        // static (sex, birth_date)
        try {
          const s = await fetch(`${API_URL}/profile/static/${userId}`, { cache: "no-store" }).then(r => r.json());
          if (alive && s?.success) {
            const st: StaticRow = s.data;
            setSex(st?.sex === "F" ? "F" : "M");
            setBirthDate(st?.birth_date || "");
          }
        } catch {}

        // estimated history
        const e = await fetch(`${API_URL}/profile/metrics/history/${userId}?metric=VO2Max_estimated`, { cache: "no-store" }).then(r => r.json());
        if (alive && e?.success) setEstHist(Array.isArray(e.data) ? e.data : []);
        else if (alive) setEstHist([]);

        // measured history
        const m = await fetch(`${API_URL}/profile/metrics/history/${userId}?metric=VO2Max_measured`, { cache: "no-store" }).then(r => r.json());
        if (alive && m?.success) setMeasHist(Array.isArray(m.data) ? m.data : []);
        else if (alive) setMeasHist([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [userId]);

  // Zjednotíme osi podľa ÚNIE dátumov (ISO dňa)
  const allDays = useMemo(() => {
    const set = new Set<string>();
    for (const r of estHist) set.add((r.measured_at || "").slice(0, 10));
    for (const r of measHist) set.add((r.measured_at || "").slice(0, 10));
    return Array.from(set).sort(); // vzostupne
  }, [estHist, measHist]);

  // orež na posledných N týždňov
  const daysLimit = weeks * 7;
  const labelsIso = useMemo(
    () => (daysLimit > 0 ? allDays.slice(-daysLimit) : allDays),
    [allDays, daysLimit]
  );
  if (!labelsIso.length) return <div className={`${CARD} p-4`}>Žiadne dáta VO₂Max.</div>;

  // mapy (ISO -> value)
  const estMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of estHist) if (typeof r.value_num === "number") m.set(r.measured_at.slice(0, 10), r.value_num);
    return m;
  }, [estHist]);
  const measMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of measHist) if (typeof r.value_num === "number") m.set(r.measured_at.slice(0, 10), r.value_num);
    return m;
  }, [measHist]);

  const labels = labelsIso.map(d => new Date(d).toLocaleDateString("sk-SK"));
  const seriesEst  = labelsIso.map(d => estMap.has(d)  ? Number(estMap.get(d))  : NaN);
  const seriesMeas = labelsIso.map(d => measMap.has(d) ? Number(measMap.get(d)) : NaN);

  // Pásma podľa veku/pohlavia
  const age = useMemo(() => {
    if (!birthDate) return 0;
    return Math.floor((Date.now() - new Date(birthDate).getTime()) / (365.25 * 86400 * 1000));
  }, [birthDate]);

  const group = (vo2Ref as Group[]).find(g => g.sex === sex && age >= g.age_min && age <= g.age_max);
  const ranges = (group?.ranges ?? []).map(r => ({ ...r, color: levelColor(r.label) }));

  // y-limit
  const maxVal = Math.max(
    0,
    ...[...seriesEst, ...seriesMeas].filter(n => Number.isFinite(n)) as number[],
    ...ranges.map(r => (typeof r.max === "number" ? r.max : 0))
  );
  const suggestedTop = Math.max(60, Math.ceil(maxVal + 1));

  // datasets
  const datasets: ChartData<"line", number[], string>["datasets"] = [
    // pásma
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
      borderColor: THEME.chart.linePrimary,
      backgroundColor: THEME.chart.linePrimary,
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
      borderColor: THEME.chart.lineSecondary,
      backgroundColor: THEME.chart.lineSecondary,
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