"use client";

import { useEffect, useMemo, useState } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import annotationPlugin from "chartjs-plugin-annotation";
import { API_URL } from "@/shared/config";
import { useUserId } from "@/shared/hooks/useUserId";
import { THEME } from "@/shared/theme/tokens";
import rhrRef from "@/data/RHR_Ref_VerywellFit.json";
import Link from "next/link";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  annotationPlugin
);

type Row = { date: string; RHR_bpm: number | null; comment?: string };
type StaticProfile = { sex: "M" | "F"; birth_date: string };

function fmtDay(iso: string) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}.${String(
    d.getMonth() + 1
  ).padStart(2, "0")}.`;
}

export default function DetailRHR() {
  const { userId } = useUserId();
  const [rows, setRows] = useState<Row[]>([]);
  const [stat, setStat] = useState<StaticProfile | null>(null);
  const [weeks, setWeeks] = useState(8); // 2/4/8/12 týždňov

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const days = weeks * 7;
      const rec = await fetch(`${API_URL}/recovery/${userId}?days=${days}`)
        .then((r) => r.json())
        .catch(() => ({}));
      if (rec?.success) setRows(rec.data);

      const st = await fetch(`${API_URL}/profile/static/${userId}`)
        .then((r) => r.json())
        .catch(() => ({}));
      if (st?.success) setStat(st.data);
    })();
  }, [userId, weeks]);

  // zoskupiť po týždňoch (1 bod = priemer RHR z daného týždňa)
  const grouped = useMemo(() => {
    const byWeek: Record<string, Row[]> = {};
    for (const r of rows) {
      const d = new Date(r.date);
      const week = `${d.getFullYear()}-W${Math.ceil(
        (d.getDate() + ((d.getDay() + 6) % 7)) / 7
      )}`;
      if (!byWeek[week]) byWeek[week] = [];
      byWeek[week].push(r);
    }
    return Object.entries(byWeek).map(([week, arr]) => {
      const avg =
        arr.reduce((s, r) => s + (r.RHR_bpm ?? 0), 0) /
        (arr.filter((r) => r.RHR_bpm != null).length || 1);
      const comment =
        arr.find((r) => r.comment)?.comment ?? ""; // vezme prvý comment v týždni
      const start = arr[0]?.date;
      const end = arr.at(-1)?.date;
      return { week, start, end, avg, comment };
    });
  }, [rows]);

  const labels = grouped.map(
    (w) => `${fmtDay(w.start ?? "")}-${fmtDay(w.end ?? "")}`
  );
  const series = grouped.map((w) => w.avg ?? null);
  const comments = grouped.map((w) => w.comment ?? "");

  // pásma podľa profilu
  const annotations = useMemo(() => {
    if (!stat) return {};
    const age = Math.floor(
      (Date.now() - new Date(stat.birth_date).getTime()) /
        (365.25 * 24 * 3600 * 1000)
    );
    const group = (rhrRef as any[]).find(
      (g) => g.sex === stat.sex && age >= g.age_min && age <= g.age_max
    );
    const bands = (group?.ranges ?? []) as {
      label: string;
      min: number | null;
      max: number | null;
      color: string;
    }[];
    const acc: any = {};
    bands.forEach((b, i) => {
      acc["band" + i] = {
        type: "box",
        yMin: b.min ?? -Infinity,
        yMax: b.max ?? Infinity,
        backgroundColor: (b.color || "#22c55e") + "33",
        borderWidth: 0,
      };
    });
    return acc;
  }, [stat]);

  const data = {
    labels,
    datasets: [
      {
        label: "Resting HR (týždenný priemer)",
        data: series,
        borderColor: "#f59e0b",
        backgroundColor: "#f59e0b",
        tension: 0.25,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
    ],
  };

  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "nearest", intersect: true }, // iba body
    plugins: {
      legend: {
        position: THEME.chart.legendPosition,
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
          title: (ctx: any) => labels[ctx[0].dataIndex],
          label: (ctx: any) => {
            const v = ctx.parsed.y;
            const c = comments[ctx.dataIndex];
            return [
              `RHR: ${v?.toFixed(1)} bpm`,
              c ? `Komentár: ${c}` : undefined,
            ].filter(Boolean) as string[];
          },
        },
      },
      annotation: { annotations },
    },
    scales: {
      y: {
        min: 40,
        max: 100,
        beginAtZero: false,
        grid: { color: THEME.chart.grid },
        title: { display: true, text: "bpm" },
      },
      x: {
        grid: { color: THEME.chart.gridSoft },
        ticks: {
          autoSkip: true,
          maxTicksLimit: 10,
          minRotation: 55,
          maxRotation: 55,
        },
      },
    },
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded shadow relative max-w-full min-w-0">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Detail – Resting HR</h2>
        <Link href="/recovery" className="px-3 py-1.5 rounded bg-gray-700 text-sm">
          Späť
        </Link>
      </div>

      <div className="mb-3 text-xs flex items-center gap-2">
        <span className="opacity-70">Rozsah:</span>
        <select
          value={weeks}
          onChange={(e) => setWeeks(Number(e.target.value))}
          className="px-2 py-1 rounded bg-gray-700"
        >
          <option value={2}>2 týždne</option>
          <option value={4}>4 týždne</option>
          <option value={8}>8 týždňov</option>
          <option value={12}>12 týždňov</option>
        </select>
      </div>

      {/* trend fixnej veľkosti – nepreteka */}
      <div
        className="rounded-md overflow-hidden"
        style={{ height: THEME.chart.weeklyHeight }}
      >
        <Line data={data} options={options} />
      </div>
    </div>
  );
}
