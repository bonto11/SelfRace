"use client";

import { useEffect, useMemo, useState } from "react";
import { Line } from "react-chartjs-2";
import type { ChartData } from "chart.js";
import Link from "next/link";

import { ensureChartJSRegistered } from "@/shared/charts/register";
import { API_URL } from "@/shared/config";
import { useUserId } from "@/shared/hooks/useUserId";
import { THEME } from "@/shared/theme/tokens";

import { isoDate, rollingMean, bandsAround } from "@/shared/utils/recovery";
import { buildRecoveryLineOptions } from "@/shared/charts/optionsRecovery";

ensureChartJSRegistered();

type Row = { date: string; HRV_avg_ms: number | null; note?: string | null };

function wrapToWidth(text: string, max = 44): string {
  if (!text) return "";
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let curr = "";
  for (const w of words) {
    const tryAdd = curr ? curr + " " + w : w;
    if (tryAdd.length > max) {
      if (curr) lines.push(curr);
      if (w.length > max) { lines.push(w); curr = ""; }
      else { curr = w; }
    } else {
      curr = tryAdd;
    }
  }
  if (curr) lines.push(curr);
  return lines.join("\n");
}

export default function DetailHRV() {
  const { userId } = useUserId();
  const [weeks, setWeeks] = useState<number>(8);
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const res = await fetch(`${API_URL}/recovery/${userId}?days=${weeks * 7}`);
      const json = await res.json().catch(() => ({}));
      const arr: Row[] = Array.isArray(json?.data) ? json.data : [];
      const norm = arr
        .map(r => ({ date: isoDate(r.date), HRV_avg_ms: r?.HRV_avg_ms ?? null, note: r?.note ?? null }))
        .sort((a, b) => a.date.localeCompare(b.date));
      setRows(norm);
    })();
  }, [userId, weeks]);

  const labelsISO = useMemo(() => rows.map(r => r.date), [rows]);
  const hrv = useMemo(() => rows.map(r => (typeof r.HRV_avg_ms === "number" ? r.HRV_avg_ms : NaN)), [rows]);

  const baselineArr = useMemo(
    () => rollingMean(rows.map(r => (typeof r.HRV_avg_ms === "number" ? r.HRV_avg_ms : null)), 14),
    [rows]
  );
  const { lower, upper } = useMemo(() => bandsAround(baselineArr, 0.05), [baselineArr]);

  const comments = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) if (r.note) m.set(r.date, r.note);
    return m;
  }, [rows]);

  const data: ChartData<"line", number[], string> = useMemo(() => {
    const toNum = (xs: (number | null)[]) => xs.map(v => (typeof v === "number" ? v : NaN));

    const bandLower = {
      type: "line" as const,
      label: "Baseline −5%",
      data: toNum(lower),
      borderColor: "rgba(16,185,129,0)",
      backgroundColor: "rgba(16,185,129,0.15)",
      pointRadius: 0,
      borderWidth: 0,
      tension: 0.2,
      order: 1,
    };
    const bandUpper = {
      type: "line" as const,
      label: "Baseline +5%",
      data: toNum(upper),
      borderColor: "rgba(16,185,129,0)",
      backgroundColor: "rgba(16,185,129,0.15)",
      pointRadius: 0,
      borderWidth: 0,
      tension: 0.2,
      fill: "-1" as const,
      order: 1,
    };
    const baselineLine = {
      type: "line" as const,
      label: "Baseline (14d priemer)",
      data: toNum(baselineArr),
      borderColor: "#22c55e",
      backgroundColor: "#22c55e",
      pointRadius: 0,
      borderWidth: 2,
      tension: 0.25,
      spanGaps: true,
      order: 2,
    };
    const hrvLine = {
      type: "line" as const,
      label: "HRV (RMSSD)",
      data: hrv,
      borderColor: "#0ea5e9",
      backgroundColor: "#0ea5e9",
      pointRadius: 3,
      borderWidth: 2,
      tension: 0.2,
      spanGaps: true,
      order: 3,
    };

    return { labels: labelsISO, datasets: [bandLower, bandUpper, baselineLine, hrvLine] };
  }, [labelsISO, lower, upper, baselineArr, hrv]);

  const options = useMemo(
    () =>
      buildRecoveryLineOptions({
        labelsISO,
        yTitle: "ms",
        tooltipTitleForIndex: (i) => {
          const iso = labelsISO[i] ?? "";
          return new Date(iso + "T00:00:00").toLocaleDateString("sk-SK");
        },
        tooltipLabelForItem: (ctx): string => {
          const idx = ctx.dataIndex ?? 0;
          const lines: string[] = [];

          if (ctx.datasetIndex === 3) {
            const v = hrv[idx];
            if (Number.isFinite(v)) lines.push(`HRV: ${Math.round(v as number)} ms`);
            const c = comments.get(labelsISO[idx] ?? "");
            if (c) lines.push(wrapToWidth(c, 44));
          }
          if (ctx.datasetIndex === 2) {
            const b = baselineArr[idx];
            if (Number.isFinite(b as number)) lines.push(`Baseline: ${Math.round(b as number)} ms`);
          }

          if (!lines.length) return `${ctx.dataset?.label ?? ""}: ${ctx.formattedValue ?? ""}`;
          return lines.join("\n");
        },
        tooltipFilter: (item) => item.datasetIndex === 2 || item.datasetIndex === 3,
      }),
    [labelsISO, hrv, baselineArr, comments]
  );

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded shadow">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="text-lg font-semibold">Detail — HRV (RMSSD)</h2>
        <div className="flex items-center gap-2">
          <select
            value={weeks}
            onChange={(e) => setWeeks(Number(e.target.value))}
            className="px-2 py-1 rounded bg-gray-700 text-sm"
          >
            <option value={2}>2 týždne</option>
            <option value={4}>4 týždne</option>
            <option value={8}>8 týždňov</option>
            <option value={12}>12 týždňov</option>
          </select>
          <Link href="/recovery" className="px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-sm">
            Späť
          </Link>
        </div>
      </div>

      <div style={{ height: THEME.chart.weeklyHeight }}>
        <Line data={data} options={options} />
      </div>
    </div>
  );
}