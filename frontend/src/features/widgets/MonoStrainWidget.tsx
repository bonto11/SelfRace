"use client";

import { useEffect, useMemo, useState } from "react";
import { Chart as MixedChart } from "react-chartjs-2";
import type { ChartData, ChartOptions } from "chart.js";
import { ensureChartJSRegistered } from "@/shared/charts/register";
import { API_URL } from "@/shared/config";
import { THEME } from "@/shared/theme/tokens";
import { useUserId } from "@/shared/hooks/useUserId";
ensureChartJSRegistered();

type Row = { label: string; mono: number | null; strain: number | null };

export default function MonoStrainWidget({
  title = "Indexy záťaže",
  onOpenDetail,
}: {
  title?: string;
  onOpenDetail?: () => void;
}) {
  const { userId } = useUserId();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  // --- fetch posledné 4 týždne z rovnakého endpointu ako WeeklyLoad ---
  useEffect(() => {
    if (!userId) return;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/analytics/weekly/${userId}?weeks=4`);
        const json = await res.json().catch(() => ({}));
        const src: any[] = Array.isArray(json?.weeks)
          ? json.weeks
          : Array.isArray(json?.data)
          ? json.data
          : [];

        const map: Row[] = src.map((w) => ({
          label: w.label ?? w.week ?? w.iso_week ?? "",
          // berieme TIME verziu indexov (ako si chcel)
          mono: Number.isFinite(w?.monotony?.time) ? +w.monotony.time : null,
          strain: Number.isFinite(w?.strain?.time) ? +w.strain.time : null,
        }));

        setRows(map);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  const labels = useMemo(() => rows.map((r) => r.label), [rows]);

  const datasets = useMemo(
    () => [
      {
        type: "line" as const,
        label: "Monotony",
        data: rows.map((r) => (r.mono ?? null)),
        yAxisID: "y1",
        borderColor: THEME.chart.monotony,
        backgroundColor: THEME.chart.monotony,
        tension: 0.3,
        pointRadius: 2,
        borderWidth: 2,
        spanGaps: true,
        order: 2,
      },
      {
        type: "line" as const,
        label: "Strain",
        data: rows.map((r) => (r.strain ?? null)),
        yAxisID: "y2",
        borderColor: THEME.chart.strain,
        backgroundColor: THEME.chart.strain,
        tension: 0.3,
        pointRadius: 2,
        borderWidth: 2,
        borderDash: [4, 4],
        spanGaps: true,
        order: 3,
      },
    ],
    [rows]
  );

  const data: ChartData<"bar" | "line", (number | null)[], string> = {
    labels,
    datasets,
  };

  const options: ChartOptions<"bar" | "line"> = {
    responsive: true,
    maintainAspectRatio: false, // dôležité – výšku riadi parent
    elements: { point: { radius: 2, hitRadius: 8 } },
    interaction: { mode: "index", intersect: false },
    animation: false,
    plugins: {
      legend: {
        position: "top",
        labels: {
          usePointStyle: true,
          pointStyle: "circle",
          boxWidth: 6,
          boxHeight: 6,
          padding: 10,
        },
      },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const label = ctx.dataset.label || "";
            const v = (ctx.parsed.y ?? 0) as number;
            if (ctx.dataset.yAxisID === "y1") return `${label}: ${v.toFixed(2)}`;
            return `${label}: ${Math.round(v)}`;
          },
        },
      },
    },
    layout: { padding: { left: 8, right: 16 } },
    scales: {
      y1: {
        position: "left",
        min: 0,
        max: 3,
        title: { display: true, text: "Monotony" },
        grid: { color: THEME.chart.grid },
      },
      y2: {
        position: "right",
        min: 0,
        // ak nemáš pevný max pre Strain, nechaj auto, ale bez kreslenia mriežky
        grid: { drawOnChartArea: false },
        title: { display: true, text: "Strain" },
      },
      x: { grid: { color: THEME.chart.gridSoft } },
    },
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded shadow">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="text-base font-semibold">{title}</h3>
        <button onClick={onOpenDetail} className="text-xs px-2 py-1 rounded bg-gray-700">
          Detail
        </button>
      </div>

      {loading ? (
        <div className="opacity-70 text-sm">Načítavam…</div>
      ) : (
        // Fix rozliezania: pevná výška wrappera
        <div style={{ height: THEME.chart.weeklyHeightCompact }}>
          <MixedChart type="line" data={data} options={options} />
        </div>
      )}
    </div>
  );
}
