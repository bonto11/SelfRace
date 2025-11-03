// src/features/trends/TrendVO2Max.tsx
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

type StaticRow = { sex?: "M" | "F" | null; birth_date?: string | null };
type RowBE = { measured_at?: string; value_num?: number | null };
type Range = { label: string; min: number | null; max: number | null };
type Group = { sex: "M" | "F"; age_min: number; age_max: number; ranges: Range[] };

function hexA(hex: string, a: number) {
  const h = (hex || "#000").replace("#", "");
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

  const [sex, setSex] = React.useState<"M" | "F">("M");
  const [birthDate, setBirthDate] = React.useState<string>("");

  const [estHist, setEstHist] = React.useState<RowBE[]>([]);
  const [measHist, setMeasHist] = React.useState<RowBE[]>([]);
  const [weeks, setWeeks] = React.useState<4 | 8 | 12>(8);

  React.useEffect(() => {
    if (!userId) return;
    let alive = true;
    console.debug("[VO2] mount userId=", userId);

    (async () => {
      setLoading(true);
      try {
        // ---- STATIC
        try {
          const s = await fetch(`${API_URL}/profile/static/${userId}`, { cache: "no-store" });
          const js = await s.json().catch(() => ({}));
          console.debug("[VO2] static:", js);
          const st: StaticRow = js?.data || {};
          if (alive) {
            setSex(st?.sex === "F" ? "F" : "M");
            setBirthDate(st?.birth_date || "");
          }
        } catch (e) {
          console.error("[VO2] static fetch error:", e);
        }

        // ---- ESTIMATED
        try {
          const r = await fetch(`${API_URL}/profile/metrics/history/${userId}?metric=VO2Max_estimated`, { cache: "no-store" });
          const js = await r.json().catch(() => ({}));
          const data: RowBE[] = Array.isArray(js?.data) ? js.data : [];
          console.debug("[VO2] estimated len=", data.length, "sample=", data[0]);
          if (alive) setEstHist(data);
        } catch (e) {
          console.error("[VO2] est fetch error:", e);
        }

        // ---- MEASURED
        try {
          const r = await fetch(`${API_URL}/profile/metrics/history/${userId}?metric=VO2Max_measured`, { cache: "no-store" });
          const js = await r.json().catch(() => ({}));
          const data: RowBE[] = Array.isArray(js?.data) ? js.data : [];
          console.debug("[VO2] measured len=", data.length, "sample=", data[0]);
          if (alive) setMeasHist(data);
        } catch (e) {
          console.error("[VO2] meas fetch error:", e);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [userId]);

  // Únia dní
  const allDays = React.useMemo(() => {
    const s = new Set<string>();
    for (const r of estHist)  if (r?.measured_at) s.add(r.measured_at.slice(0, 10));
    for (const r of measHist) if (r?.measured_at) s.add(r.measured_at.slice(0, 10));
    const arr = Array.from(s).sort();
    console.debug("[VO2] union days cnt=", arr.length, "first/last=", arr[0], arr[arr.length - 1]);
    return arr;
  }, [estHist, measHist]);

  const daysLimit = weeks * 7;
  const labelsIso = React.useMemo(
    () => (daysLimit > 0 ? allDays.slice(-daysLimit) : allDays),
    [allDays, daysLimit]
  );
  if (!labelsIso.length) {
    console.debug("[VO2] no labels -> empty view");
    return <div className={`${CARD} p-4`}>Žiadne dáta VO₂Max.</div>;
  }

  // mapy dátum -> hodnota
  const toMap = (rows: RowBE[]) => {
    const m = new Map<string, number>();
    for (const r of rows) {
      const d = (r?.measured_at || "").slice(0, 10);
      if (d && typeof r?.value_num === "number") m.set(d, r.value_num);
    }
    return m;
  };
  const estMap  = React.useMemo(() => toMap(estHist),  [estHist]);
  const measMap = React.useMemo(() => toMap(measHist), [measHist]);

  const labels = labelsIso.map(d => new Date(d).toLocaleDateString("sk-SK"));
  let seriesEst  = labelsIso.map(d => estMap.has(d)  ? Number(estMap.get(d))  : NaN);
  let seriesMeas = labelsIso.map(d => measMap.has(d) ? Number(measMap.get(d)) : NaN);

  // single-point → flat line
  const flat = (arr: number[]) => {
    const vals = arr.filter(Number.isFinite) as number[];
    return vals.length === 1 && arr.length >= 2 ? arr.map(() => vals[0]!) : arr;
  };
  const singleEst  = (seriesEst.filter(Number.isFinite) as number[]).length === 1 && seriesEst.length >= 2;
  const singleMeas = (seriesMeas.filter(Number.isFinite) as number[]).length === 1 && seriesMeas.length >= 2;
  seriesEst  = flat(seriesEst);
  seriesMeas = flat(seriesMeas);

  console.debug("[VO2] labels cnt=", labels.length, "est finite=", (seriesEst.filter(Number.isFinite) as number[]).length, "meas finite=", (seriesMeas.filter(Number.isFinite) as number[]).length, "singleEst=", singleEst, "singleMeas=", singleMeas);

  // pásma
  const age = React.useMemo(() => {
    if (!birthDate) return 0;
    return Math.floor((Date.now() - new Date(birthDate).getTime()) / (365.25 * 24 * 3600 * 1000));
  }, [birthDate]);

  const group = (vo2Ref as Group[]).find(g => g.sex === sex && age >= g.age_min && age <= g.age_max);
  const ranges = (group?.ranges ?? []).map(r => ({ ...r, color: levelColor(r.label) }));
  console.debug("[VO2] ranges cnt=", ranges.length, "sex=", sex, "age=", age, "group=", group);

  const maxVal = Math.max(
    0,
    ...[...seriesEst, ...seriesMeas].filter(Number.isFinite) as number[],
    ...ranges.map(r => (typeof r.max === "number" ? r.max : 0))
  );
  const suggestedTop = Math.max(60, Math.ceil(maxVal + 1));

  const datasets: ChartData<"line", number[], string>["datasets"] = [
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
  console.debug("[VO2] dataset lens -> ranges:", ranges.length, "est:", seriesEst.length, "meas:", seriesMeas.length);

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