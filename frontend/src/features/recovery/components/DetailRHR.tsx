"use client";

import { useEffect, useMemo, useState } from "react";
import { Line } from "react-chartjs-2";
import type { ChartData } from "chart.js";
import { ensureChartJSRegistered } from "@/shared/charts/register";
import { API_URL } from "@/shared/config";
import { useUserId } from "@/shared/hooks/useUserId";
import { THEME } from "@/shared/theme/tokens";

import {
  isoDate,
  rollingMean,
  bandsAround,
} from "@/shared/utils/recovery";
import { buildRecoveryLineOptions } from "@/shared/charts/optionsRecovery";
import Link from "next/link";

ensureChartJSRegistered();

type Row = { date: string; RHR_bpm: number | null; note?: string | null };

function wrapToWidth(text: string, max = 44): string {
  if (!text) return "";
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let curr = "";
  for (const w of words) {
    const tryAdd = curr ? curr + " " + w : w;
    if (tryAdd.length > max) {
      if (curr) lines.push(curr);
      if (w.length > max) {
        // slovo dlhšie než max -> akceptuj ako zvlášť riadok
        lines.push(w);
        curr = "";
      } else {
        curr = w;
      }
    } else {
      curr = tryAdd;
    }
  }
  if (curr) lines.push(curr);
  return lines.join("\n");
}

export default function DetailRHR() {
  const { userId } = useUserId();
  const [weeks, setWeeks] = useState<number>(8); // 2/4/8/12
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const days = weeks * 7;
      const res = await fetch(`${API_URL}/recovery/${userId}?days=${days}`);
      const json = await res.json().catch(() => ({}));
      const arr: Row[] = Array.isArray(json?.data) ? json.data : [];
      // normalizácia dátumu + záruka fixed pořadia zľava -> vpravo
      const norm = arr
        .map((r) => ({ date: isoDate(r.date), RHR_bpm: r?.RHR_bpm ?? null, note: r?.note ?? null }))
        .sort((a, b) => a.date.localeCompare(b.date));
      setRows(norm);
    })();
  }, [userId, weeks]);

  const labelsISO = useMemo(() => rows.map((r) => r.date), [rows]);
  const rhr = useMemo(
    () => rows.map((r) => (typeof r.RHR_bpm === "number" ? r.RHR_bpm : NaN)),
    [rows]
  );

  // baseline (rolling mean z predchádzajúcich dní)
  const baseline = useMemo(() => rollingMean(rows.map(r => (typeof r.RHR_bpm === "number" ? r.RHR_bpm : null)), 14), [rows]);
  const { lower, upper } = useMemo(() => bandsAround(baseline, 0.05), [baseline]);

  // mapka komentárov
  const comments = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) if (r.note) m.set(r.date, r.note);
    return m;
  }, [rows]);

  // datasets
  const data: ChartData<"line", number[], string> = useMemo(() => {
    const asNum = (xs: (number | null)[]) => xs.map((v) => (typeof v === "number" ? v : NaN));

    // Pozadie pásma: prvý dataset (lower) bez fill, druhý (upper) fill k predchádzajúcemu
    const bandLower = {
      type: "line" as const,
      label: "Baseline −5%",
      data: asNum(lower),
      borderColor: "rgba(16,185,129,0.0)",
      backgroundColor: "rgba(16,185,129,0.15)",
      pointRadius: 0,
      borderWidth: 0,
      tension: 0.2,
      order: 1,
    };
    const bandUpper = {
      type: "line" as const,
      label: "Baseline +5%",
      data: asNum(upper),
      borderColor: "rgba(16,185,129,0.0)",
      backgroundColor: "rgba(16,185,129,0.15)",
      pointRadius: 0,
      borderWidth: 0,
      tension: 0.2,
      fill: "-1" as const,      // vyplň k predošlému datasetu (lower)
      order: 1,
    };

    const baseLine = {
      type: "line" as const,
      label: "Baseline (14d priemer)",
      data: asNum(baseline),
      borderColor: "#22c55e",
      backgroundColor: "#22c55e",
      pointRadius: 0,
      borderWidth: 2,
      tension: 0.25,
      spanGaps: true,
      order: 2,
    };

    const rhrLine = {
      type: "line" as const,
      label: "Resting HR",
      data: rhr,
      borderColor: "#f59e0b",
      backgroundColor: "#f59e0b",
      pointRadius: 3,
      borderWidth: 2,
      tension: 0.2,
      spanGaps: true,
      order: 3,
    };

    return { labels: labelsISO, datasets: [bandLower, bandUpper, baseLine, rhrLine] };
  }, [labelsISO, lower, upper, baseline, rhr]);

  // options (spoločné)
  const options = useMemo(() =>
    buildRecoveryLineOptions({
      labelsISO,
      yTitle: "bpm",
      tooltipFilter: (item) => item.datasetIndex >= 2, // skryť „bandy“ z tooltipu
      tooltipTitleForIndex: (i) => {
        const iso = labelsISO[i] ?? "";
        const d = new Date(iso + "T00:00:00");
        return d.toLocaleDateString("sk-SK");
      },
      tooltipLabelForItem: (ctx) => {
        const idx = ctx?.dataIndex ?? 0;
        const iso = labelsISO[idx] ?? "";

        // RHR dataset (posledný)
        if (ctx.datasetIndex === 3) {
          const v = rhr[idx];
          let s = `RHR: ${Number.isFinite(v) ? Math.round(v as number) : "—"} bpm`;
          const c = comments.get(iso);
          if (c) s += ` — ${wrapToWidth(c, 44)}`;
          return s;
        }
        // baseline dataset (zelená čiara)
        if (ctx.datasetIndex === 2) {
          const b = baseline[idx];
          return `Baseline: ${typeof b === "number" ? Math.round(b) : "—"} bpm`;
        }
        return ""; // nič iné v tooltipe
      },
    }), [labelsISO, rhr, baseline, comments]);

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded shadow">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="text-lg font-semibold">Detail — Resting HR</h2>
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
          <Link
            href="/recovery"
            className="px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-sm"
          >
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
