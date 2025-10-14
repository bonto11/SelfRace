// src/features/recovery/components/DetailRHR.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Line } from "react-chartjs-2";
import type { ChartData, ChartOptions } from "chart.js";
import { API_URL } from "@/shared/config";
import { useUserId } from "@/shared/hooks/useUserId";
import { THEME } from "@/shared/theme/tokens";

import {
  toISODate,
  makeRollingBaseline,
} from "@/shared/utils/recovery";
import { buildRecoveryLineOptions } from "@/shared/charts/optionsRecovery";

type Row = {
  date: string;
  RHR_bpm: number | null;
  note?: string | null;
};

export default function DetailRHR() {
  const { userId } = useUserId();
  const [weeks, setWeeks] = useState<number>(8);
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

  // x-os: každý deň
  const labelsISO = useMemo<string[]>(
    () => rows.map(r => toISODate(r.date)),
    [rows]
  );

  const rhr = useMemo<number[]>(
    () => rows.map(r => (typeof r.RHR_bpm === "number" ? r.RHR_bpm : NaN)),
    [rows]
  );

  const commentsMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) if (r.note) m.set(toISODate(r.date), r.note);
    return m;
  }, [rows]);

  // Rolling baseline ±5 %
  const { baseline, lower, upper } = useMemo(
    () => makeRollingBaseline(rhr, 14, 0.05),
    [rhr]
  );

  const data: ChartData<"line"> = useMemo(() => ({
    labels: labelsISO,
    datasets: [
      // baseline pásma – tenké linky (ak chceš, dá sa neskôr nahradiť „box“ anotáciami)
      {
        type: "line",
        label: "Baseline −5%",
        data: lower.map(v => (typeof v === "number" ? v : NaN)),
        borderColor: "#ef4444",
        borderWidth: 1,
        pointRadius: 0,
        tension: 0.2,
        order: 1,
      },
      {
        type: "line",
        label: "Baseline +5%",
        data: upper.map(v => (typeof v === "number" ? v : NaN)),
        borderColor: "#ef4444",
        borderWidth: 1,
        pointRadius: 0,
        tension: 0.2,
        order: 1,
      },
      {
        type: "line",
        label: "Baseline (14d priemer)",
        data: baseline.map(v => (typeof v === "number" ? v : NaN)),
        borderColor: "#22c55e",
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.2,
        order: 2,
      },
      {
        type: "line",
        label: "Resting HR",
        data: rhr,
        borderColor: "#f59e0b",
        backgroundColor: "#f59e0b",
        pointRadius: 3,
        pointHoverRadius: 4,
        tension: 0.2,
        order: 3,
      },
    ],
  }), [labelsISO, lower, upper, baseline, rhr]);

  const options: ChartOptions<"line"> = useMemo(
    () =>
      buildRecoveryLineOptions({
        labelsISO,
        yTitle: "bpm",
        // tooltip title – už je z buildera, tu iba doplníme komentár do „label“
        tooltipLabelForItem: (ctx: any) => {
          // iba pre RHR dataset (posledný dataset)
          const isRhr = ctx.datasetIndex === 3;
          if (!isRhr) return `${ctx.dataset?.label}: ${ctx.formattedValue}`;
          const idx = ctx.dataIndex ?? 0;
          const iso = labelsISO[idx] ?? "";
          const c = commentsMap.get(iso);
          return c
            ? `RHR: ${ctx.formattedValue} bpm — ${c}`
            : `RHR: ${ctx.formattedValue} bpm`;
        },
        // skryť tooltip položky baseline −/+5 (nech zostane prehľadný)
        tooltipFilter: (item: any) => item.datasetIndex >= 2,
      }),
    [labelsISO, commentsMap]
  );

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded shadow">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="text-lg font-semibold">Detail — Resting HR</h2>
        <div className="text-xs flex items-center gap-2">
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
      </div>

      {/* fixná výška – nič nepretečie, X oseľ rotácia 55° */}
      <div style={{ height: THEME.chart.weeklyHeight }}>
        <Line data={data} options={options} />
      </div>
    </div>
  );
}
