"use client";

import { useEffect, useMemo, useState } from "react";
import { Line } from "react-chartjs-2";
import { ensureChartJSRegistered } from "@/shared/charts/register";
import { API_URL } from "@/shared/config";
import { useUserId } from "@/shared/hooks/useUserId";
import { THEME } from "@/shared/theme/tokens";
import { buildRecoveryOptions } from "@/shared/charts/optionsRecovery";
import Link from "next/link";

ensureChartJSRegistered();

type Row = { date: string; RHR_bpm: number | null; comment?: string };

function fmtDay(d: Date) {
  const dd = String(d.getDate()).padStart(1, "0");
  const mm = String(d.getMonth() + 1);
  return `${dd}.${mm}.`;
}
function rangeLabel(startISO?: string, endISO?: string) {
  if (!startISO || !endISO) return "";
  const s = new Date(startISO);
  const e = new Date(endISO);
  if (s.getMonth() === e.getMonth()) return `${s.getDate()}–${e.getDate()}.${e.getMonth() + 1}.`;
  return `${fmtDay(s)}–${fmtDay(e)}`;
}

export default function DetailRHR() {
  const { userId } = useUserId();
  const [weeks, setWeeks] = useState(8); // 2/4/8/12
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const days = weeks * 7;
      const res = await fetch(`${API_URL}/recovery/${userId}?days=${days}`);
      const json = await res.json().catch(() => ({}));
      if (json?.success && Array.isArray(json.data)) setRows(json.data);
    })();
  }, [userId, weeks]);

  // Zoradené denné dáta (1 bod = 1 deň)
  const days = useMemo(() => {
    const a = [...rows].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    return a;
  }, [rows]);

  // Denné popisky (nebudú sa zobrazovať; používame len na indexy)
  const labelsDaily = useMemo(() => days.map((d) => d.date), [days]);

  // Týždenné labely / grid: na každý 7. index zobrazíme rozsah týždňa
  const weekLabelForIndex = useMemo(() => {
    // rozsekaj po 7 dňoch
    const chunks: { start?: string; end?: string }[] = [];
    for (let i = 0; i < days.length; i += 7) {
      chunks.push({ start: days[i]?.date, end: days[Math.min(i + 6, days.length - 1)]?.date });
    }
    return (index: number) => {
      // label ukážeme na poslednom dni v bloku (…6, …13, …20, …)
      if ((index + 1) % 7 !== 0) return "";
      const block = Math.floor(index / 7);
      const c = chunks[block];
      return rangeLabel(c?.start, c?.end);
    };
  }, [days]);

  // Dataset – denné body
  const series = useMemo(
    () => days.map((d) => (d.RHR_bpm == null ? null : Number(d.RHR_bpm))),
    [days]
  );
  const comments = useMemo(() => days.map((d) => d.comment ?? ""), [days]);

  const data = useMemo(
    () => ({
      labels: labelsDaily,
      datasets: [
        {
          label: "Resting HR",
          data: series,
          borderColor: "#f59e0b",
          backgroundColor: "#f59e0b",
          tension: 0.25,
          pointRadius: 3,
          pointHoverRadius: 6,
        },
      ],
    }),
    [labelsDaily, series]
  );

  // Spoločné options (fixná výška, žiadne pretekanie, 55° popisky po týždňoch)
  const options = useMemo(() => {
    const base = buildRecoveryOptions("bpm", { min: 40, max: 100 }, weekLabelForIndex);
    // doplníme tooltip (title = dátum dňa, label = hodnota + komentár)
    return {
      ...base,
      plugins: {
        ...base.plugins,
        tooltip: {
          ...base.plugins?.tooltip,
          callbacks: {
            title: (ctx: any) => {
              const iso = labelsDaily[ctx[0].dataIndex];
              const d = new Date(iso);
              return d.toLocaleDateString("sk-SK");
            },
            label: (ctx: any) => {
              const v = ctx.parsed.y;
              const c = comments[ctx.dataIndex];
              return [
                `RHR: ${v?.toFixed?.(1)} bpm`,
                c ? `Komentár: ${c}` : undefined,
              ].filter(Boolean) as string[];
            },
          },
        },
      },
    } as typeof base;
  }, [labelsDaily, comments, weekLabelForIndex]);

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

      {/* fixná výška – žiadne pretekanie */}
      <div className="rounded-md overflow-hidden" style={{ height: THEME.chart.weeklyHeight }}>
        <Line data={data} options={options} />
      </div>
    </div>
  );
}
