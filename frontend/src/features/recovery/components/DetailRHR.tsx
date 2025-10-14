"use client";

import { useEffect, useMemo, useState } from "react";
import { Line } from "react-chartjs-2";
import { ensureChartJSRegistered } from "@/shared/charts/register";
import { API_URL } from "@/shared/config";
import { THEME } from "@/shared/theme/tokens";
import { useUserId } from "@/shared/hooks/useUserId";
import {
  isoDate, rollingMean, bandsAround, wrapTextToLines, bandFromBaseline
} from "@/shared/utils/recovery";
import { buildRecoveryLineOptions } from "@/shared/charts/optionsRecovery";

ensureChartJSRegistered();

type Row = { date: string; RHR_bpm: number | null; note?: string | null };

export default function DetailRHR() {
  const { userId } = useUserId();
  const [weeks, setWeeks] = useState(8);      // 2 / 4 / 8 / 12
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const days = weeks * 7;
      const res = await fetch(`${API_URL}/recovery/${userId}?days=${days}`);
      const json = await res.json().catch(() => ({}));
      const arr: Row[] = Array.isArray(json?.data) ? json.data : [];
      // chronologicky zľava → doprava
      arr.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setRows(arr);
    })();
  }, [userId, weeks]);

  // os X – všetky dni
  const labelsISO = useMemo(() => rows.map(r => isoDate(r.date)), [rows]);

  // dáta
  const rhr = useMemo(() => rows.map(r => (r.RHR_bpm ?? null)), [rows]);

  // baseline (rolling priemer z predchádzajúcich 14 dní) + ±5 %
  const baseline = useMemo(() => rollingMean(rhr, 14), [rhr]);
  const { lower, upper } = useMemo(() => bandFromBaseline(baseline, 0.05), [baseline]);

  // mapka komentárov podľa dňa
  const commentsMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) if (r.note) m.set(isoDate(r.date), r.note);
    return m;
  }, [rows]);

  const data = useMemo(() => ({
    labels: labelsISO,
    datasets: [
      {
        type: "line" as const,
        label: "Baseline −5%",
        data: lower,
        borderColor: "transparent",
        pointRadius: 0,
        fill: "+1",                // vyplní priestor po ďalší dataset (baseline)
        backgroundColor: "rgba(34,197,94,0.18)", // jemná zelená
        order: 1,
      },
      {
        type: "line" as const,
        label: "Baseline (14d priemer)",
        data: baseline,
        borderColor: THEME.chart.monotony,
        backgroundColor: THEME.chart.monotony,
        borderWidth: 2,
        pointRadius: 0,
        order: 2,
      },
      {
        type: "line" as const,
        label: "Baseline +5%",
        data: upper,
        borderColor: "transparent",
        pointRadius: 0,
        fill: "-1",                // vyplní medzi týmto a predchádzajúcim datasetom
        backgroundColor: "rgba(34,197,94,0.18)",
        order: 1,
      },
      {
        type: "line" as const,
        label: "Resting HR",
        data: rhr,
        borderColor: "#f59e0b",
        backgroundColor: "#f59e0b",
        pointRadius: 3,
        tension: 0.25,
        order: 3,
      },
    ],
  }), [labelsISO, lower, baseline, upper, rhr]);

  const options = useMemo(() => buildRecoveryLineOptions({
    labelsISO,
    yTitle: "bpm",
    tooltipLabelForItem: (ctx) => {
      // baseline + RHR bežným spôsobom, komentár zalomíme do ďalších riadkov
      const idx = ctx.dataIndex ?? 0;
      const iso = labelsISO[idx] ?? "";
      const lines: string[] = [];
      if (ctx.datasetIndex === 3) { // RHR dataset
        const v = rhr[idx];
        lines.push(`RHR: ${isFinite(v as number) ? Math.round(v as number) : "—"} bpm`);
        const c = commentsMap.get(iso);
        if (c) lines.push(...wrapTextToLines(c, 44));
        return lines;
      }
      if (ctx.datasetIndex === 1) {
        const b = baseline[idx];
        lines.push(`Baseline: ${isFinite(b as number) ? Math.round(b as number) : "—"} bpm`);
        return lines;
      }
      return ""; // ostatné dataset-y potlačí filter nižšie
    },
    tooltipFilter: (item) => [1, 3].includes(item.datasetIndex), // len baseline a RHR
  }), [labelsISO, baseline, rhr, commentsMap]);

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded shadow">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="text-lg font-semibold">Detail — Resting HR</h2>
        <div className="flex items-center gap-2">
          <span className="opacity-70 text-sm">Rozsah:</span>
          <select
            value={weeks}
            onChange={(e)=>setWeeks(Number(e.target.value))}
            className="px-2 py-1 rounded bg-gray-700 text-sm"
          >
            <option value={2}>2 týždne</option>
            <option value={4}>4 týždne</option>
            <option value={8}>8 týždňov</option>
            <option value={12}>12 týždňov</option>
          </select>
          <button onClick={() => history.back()} className="px-3 py-1 rounded bg-gray-700">Späť</button>
        </div>
      </div>

      <div style={{ height: 360 }}>
        <Line data={data} options={options} />
      </div>
    </div>
  );
}
