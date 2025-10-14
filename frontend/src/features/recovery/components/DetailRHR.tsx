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
  const dd = d.getDate();
  const mm = d.getMonth() + 1;
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
  const [weeks, setWeeks] = useState(8); // 2 / 4 / 8 / 12
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

  // zoradené denné dáta
  const days = useMemo(
    () => [...rows].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [rows]
  );

  const labelsDaily = useMemo(() => days.map((d) => d.date), [days]);
  const values = useMemo(
    () => days.map((d) => (d.RHR_bpm == null ? NaN : Number(d.RHR_bpm))),
    [days]
  );
  const comments = useMemo(() => days.map((d) => d.comment ?? ""), [days]);

  // týždenné popisky a grid (každý 7. deň)
  const weekLabelForIndex = useMemo(() => {
    const chunks: { start?: string; end?: string }[] = [];
    for (let i = 0; i < days.length; i += 7) {
      chunks.push({
        start: days[i]?.date,
        end: days[Math.min(i + 6, days.length - 1)]?.date,
      });
    }
    return (index: number) => {
      if ((index + 1) % 7 !== 0) return "";
      const block = Math.floor(index / 7);
      const c = chunks[block];
      return rangeLabel(c?.start, c?.end);
    };
  }, [days]);

  // ----- Rolling baseline (14 dní) a pásmo ±5 % -----
  const WINDOW = 14;        // veľkosť okna
  const TOL = 0.05;         // +-5 %
  const baseline = useMemo(() => {
    const out: (number | null)[] = new Array(values.length).fill(null);
    for (let i = 0; i < values.length; i++) {
      const from = Math.max(0, i - WINDOW);      // berieme posledných 14 dní PRED daným dňom
      const to = i - 1;
      if (to < from) continue;
      const slice = values.slice(from, to + 1).filter((v) => Number.isFinite(v)) as number[];
      if (slice.length >= Math.min(7, WINDOW / 2)) {
        out[i] = slice.reduce((s, v) => s + v, 0) / slice.length;
      }
    }
    return out;
  }, [values]);

  const bandLower = useMemo(
    () => baseline.map((b) => (b == null ? NaN : b * (1 - TOL))),
    [baseline]
  );
  const bandUpper = useMemo(
    () => baseline.map((b) => (b == null ? NaN : b * (1 + TOL))),
    [baseline]
  );

  // Datasety: spodná a horná hranica pásma (vyplní sa plocha medzi nimi),
  // tenká baseline (stred) a hlavná séria RHR bodov.
  const data = useMemo(
    () => ({
      labels: labelsDaily,
      datasets: [
        {
          // lower bound
          type: "line" as const,
          label: "Baseline −5%",
          data: bandLower,
          yAxisID: "y",
          borderWidth: 0,
          pointRadius: 0,
        },
        {
          // upper bound – fill k predošlému datasetu => vyfarbené pásmo
          type: "line" as const,
          label: "Baseline +5%",
          data: bandUpper,
          yAxisID: "y",
          borderWidth: 0,
          pointRadius: 0,
          backgroundColor: "rgba(34,197,94,0.12)", // bledozelená
          fill: "-1" as const,
        },
        {
          // stred baseline – tenká čiara
          type: "line" as const,
          label: "Baseline (14d priemer)",
          data: baseline.map((b) => (b == null ? NaN : b)),
          yAxisID: "y",
          borderColor: "rgba(34,197,94,0.9)",
          backgroundColor: "rgba(34,197,94,0.9)",
          borderDash: [6, 3],
          pointRadius: 0,
          tension: 0.25,
        },
        {
          // hlavná séria – jediné „klikateľné“ body
          type: "line" as const,
          label: "Resting HR",
          data: values,
          yAxisID: "y",
          borderColor: "#f59e0b",
          backgroundColor: "#f59e0b",
          tension: 0.25,
          pointRadius: 3,
          pointHoverRadius: 6,
        },
      ],
    }),
    [labelsDaily, bandLower, bandUpper, baseline, values]
  );

  // Options – 55° X ticks, týždenný grid; tooltip len pre „Resting HR“
  const options = useMemo(() => {
    const base = buildRecoveryOptions("bpm", { min: 40, max: 100 }, weekLabelForIndex);
    return {
      ...base,
      plugins: {
        ...base.plugins,
        tooltip: {
          ...base.plugins?.tooltip,
          filter: (item: any) => item.dataset?.label === "Resting HR", // ignoruj pásmo/baseline
          callbacks: {
            title: (ctx: any) => {
              const iso = labelsDaily[ctx[0].dataIndex];
              return new Date(iso).toLocaleDateString("sk-SK");
            },
            label: (ctx: any) => {
              const v = ctx.parsed.y;
              const c = comments[ctx.dataIndex];
              return c ? [`RHR: ${v?.toFixed?.(1)} bpm`, `Komentár: ${c}`] : [`RHR: ${v?.toFixed?.(1)} bpm`];
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
        <Link href="/recovery" className="px-3 py-1.5 rounded bg-gray-700 text-sm">Späť</Link>
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

      {/* fixná výška – nepretečie */}
      <div className="rounded-md overflow-hidden" style={{ height: THEME.chart.weeklyHeight }}>
        <Line data={data} options={options} />
      </div>
    </div>
  );
}
