// src/features/trends/TrendBodyFat.tsx
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

type StaticProfile = { sex?: "M" | "F" | null };
type RowBE = { measured_at?: string; value_num?: number | null };

function hexA(hex: string, a: number) {
  const h = (hex || "#000").replace("#", "");
  const aa = Math.round(Math.min(Math.max(a, 0), 1) * 255)
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();
  return `#${h}${aa}`;
}

function colorForBandLabel(labelRaw: string) {
  const l = (labelRaw || "").toLowerCase();
  if (l.includes("athlete"))   return THEME.chart.athletes;
  if (l.includes("fitness"))   return THEME.chart.fitness;
  if (l.includes("average"))   return THEME.chart.average;
  if (l.includes("essential")) return THEME.chart.essential;
  if (l.includes("obese"))     return THEME.chart.obese;
  return THEME.chart.neutral;
}

export default function TrendBodyFat() {
  const { userId } = useUserId();
  const [loading, setLoading] = React.useState(false);
  const [sex, setSex] = React.useState<"M" | "F">("M");
  const [rows, setRows] = React.useState<{ d: string; v: number | null }[]>([]);
  const [weeks, setWeeks] = React.useState<4 | 8 | 12>(12);

  React.useEffect(() => {
    if (!userId) return;
    let alive = true;
    console.debug("[BF] mount userId=", userId);

    (async () => {
      setLoading(true);
      try {
        // ---- STATIC
        try {
          const sResp = await fetch(`${API_URL}/profile/static/${userId}`, { cache: "no-store" });
          const sJs = await sResp.json().catch(() => ({}));
          console.debug("[BF] static resp:", sJs);
          const sx = (sJs?.data?.sex === "F" ? "F" : "M") as "M" | "F";
          if (alive) setSex(sx);
        } catch (e) {
          console.error("[BF] static fetch error:", e);
        }

        // ---- HISTORY
        try {
          const r = await fetch(`${API_URL}/profile/metrics/history/${userId}?metric=body_fat_pct`, { cache: "no-store" });
          const js = await r.json().catch(() => ({}));
          const raw: RowBE[] = Array.isArray(js?.data) ? js.data : [];
          console.debug("[BF] history raw len=", raw.length, "sample=", raw[0]);
          const mapped = raw
            .map(x => ({
              d: (x?.measured_at || "").slice(0, 10),
              v: typeof x?.value_num === "number" ? x.value_num : null,
            }))
            .filter(x => x.d);
          console.debug("[BF] mapped len=", mapped.length, "sample=", mapped.slice(0, 3));
          if (alive) setRows(mapped);
        } catch (e) {
          console.error("[BF] history fetch error:", e);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [userId]);

  if (!rows.length) {
    console.debug("[BF] no rows -> empty view");
    return <div className={`${CARD} p-4`}>Žiadne dáta Body Fat %.</div>;
  }

  // posledných N týždňov (po dňoch)
  const days = weeks * 7;
  const last = rows.slice(-days);
  const labelsIso = last.map(r => r.d);
  const labels = labelsIso.map(d => new Date(d).toLocaleDateString("sk-SK"));
  const values = last.map(r => (typeof r.v === "number" ? r.v : NaN));

  // single-point → flat line
  const finiteVals = values.filter(n => Number.isFinite(n)) as number[];
  const singlePoint = finiteVals.length === 1 && values.length >= 2;
  const lineValues = singlePoint ? values.map(() => finiteVals[0]!) : values;

  console.debug("[BF] labels cnt=", labels.length, "finite cnt=", finiteVals.length, "singlePoint=", singlePoint);

  const seriesMax = Math.max(0, ...(lineValues.filter(Number.isFinite) as number[]));
  const suggestedTop = Math.max(35, Math.ceil(seriesMax + 1));

  const bands = getBodyFatBands(sex);
  console.debug("[BF] bands sex=", sex, "bands cnt=", bands.length, bands);

  const datasets: ChartData<"line", number[], string>["datasets"] = [
    ...bands.map((b, i) => {
      const color = colorForBandLabel(b.label || "");
      const yMax = typeof b.max === "number" ? b.max : suggestedTop;
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
    {
      type: "line" as const,
      label: "Body Fat %",
      data: lineValues,
      borderColor: THEME.chart.linePrimary,
      backgroundColor: THEME.chart.linePrimary,
      pointRadius: 2,
      borderWidth: 2,
      tension: 0.25,
      spanGaps: true,
      order: 2,
    },
  ];
  console.debug("[BF] dataset lens -> bands:", bands.length, "line:", lineValues.length);

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