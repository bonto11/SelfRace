"use client";
import { useEffect, useMemo, useState } from "react";
import { Line } from "react-chartjs-2";
import { ensureChartJSRegistered } from "@/shared/charts/register";
import { API_URL } from "@/shared/config";
import { THEME } from "@/shared/theme/tokens";
import { useUserId } from "@/shared/hooks/useUserId";
import {
  isoDate,
  rollingMean,
  bandsAround,
  wrapTextToLines,
  bandFromBaseline,
} from "@/shared/utils/recovery";
import { buildRecoveryLineOptions } from "@/shared/charts/optionsRecovery";

ensureChartJSRegistered();

type Row = { date: string; HRV_avg_ms: number | null; note?: string | null };

export default function DetailHRV() {
  const { userId } = useUserId();
  const [weeks, setWeeks] = useState(8);
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const days = weeks * 7;
      const res = await fetch(`${API_URL}/recovery/${userId}?days=${days}`);
      const json = await res.json().catch(() => ({}));
      const arr: Row[] = Array.isArray(json?.data) ? json.data : [];
      arr.sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      setRows(arr);
    })();
  }, [userId, weeks]);

  const labelsISO = useMemo(() => rows.map((r) => isoDate(r.date)), [rows]);
  const hrv = useMemo(() => rows.map((r) => r.HRV_avg_ms ?? null), [rows]);
  const baseline = useMemo(() => rollingMean(hrv, 14), [hrv]);
  const { lower, upper } = useMemo(
    () => bandFromBaseline(baseline, 0.05),
    [baseline]
  );

  const comments = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) if (r.note) m.set(isoDate(r.date), r.note);
    return m;
  }, [rows]);

  const data = useMemo(
    () => ({
      labels: labelsISO,
      datasets: [
        {
          type: "line" as const,
          label: "Baseline −5%",
          data: lower,
          borderColor: "transparent",
          pointRadius: 0,
          fill: "+1",
          backgroundColor: "rgba(34,197,94,0.18)",
        },
        {
          type: "line" as const,
          label: "Baseline (14d priemer)",
          data: baseline,
          borderColor: THEME.chart.monotony,
          backgroundColor: THEME.chart.monotony,
          borderWidth: 2,
          pointRadius: 0,
        },
        {
          type: "line" as const,
          label: "Baseline +5%",
          data: upper,
          borderColor: "transparent",
          pointRadius: 0,
          fill: "-1",
          backgroundColor: "rgba(34,197,94,0.18)",
        },
        {
          type: "line" as const,
          label: "HRV (RMSSD)",
          data: hrv,
          borderColor: "#06b6d4",
          backgroundColor: "#06b6d4",
          pointRadius: 3,
          tension: 0.25,
        },
      ],
    }),
    [labelsISO, lower, baseline, upper, hrv]
  );

  const options = useMemo(
    () =>
      buildRecoveryLineOptions({
        labelsISO,
        yTitle: "ms",
        tooltipLabelForItem: (ctx) => {
          const idx = ctx.dataIndex ?? 0;
          const iso = labelsISO[idx] ?? "";
          if (ctx.datasetIndex === 3) {
            const v = hrv[idx];
            const lines = [
              `HRV: ${
                isFinite(v as number) ? Math.round(v as number) : "—"
              } ms`,
            ];
            const c = comments.get(iso);
            if (c) lines.push(...wrapTextToLines(c, 44));
            return lines;
          }
          if (ctx.datasetIndex === 1) {
            const b = baseline[idx];
            return [
              `Baseline: ${
                isFinite(b as number) ? Math.round(b as number) : "—"
              } ms`,
            ];
          }
          return "";
        },
        tooltipFilter: (it) => [1, 3].includes(it.datasetIndex),
      }),
    [labelsISO, hrv, baseline, comments]
  );

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded shadow">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="text-lg font-semibold">Detail — HRV (RMSSD)</h2>
        <div className="flex items-center gap-2">
          <span className="opacity-70 text-sm">Rozsah:</span>
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
          <button
            onClick={() => history.back()}
            className="px-3 py-1 rounded bg-gray-700"
          >
            Späť
          </button>
        </div>
      </div>
      <div style={{ height: 360 }}>
        <Line data={data} options={options} />
      </div>
    </div>
  );
}
