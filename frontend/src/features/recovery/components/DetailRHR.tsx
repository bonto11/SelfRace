"use client";

import { useEffect, useMemo, useState } from "react";
import { Line } from "react-chartjs-2";
import { useRouter } from "next/navigation";

import { ensureChartJSRegistered } from "@/shared/charts/register";
import { API_URL } from "@/shared/config";
import { useUserId } from "@/shared/hooks/useUserId";
import { THEME } from "@/shared/theme/tokens";

import {
  isoDate,
  rollingMean,
  bandsAround,
  DayPoint,
} from "@/shared/utils/recovery";
import { buildRecoveryLineOptions } from "@/shared/charts/optionsRecovery";

ensureChartJSRegistered();

type Row = { date: string; RHR_bpm: number | null; comments?: string | null };

export default function DetailRHR() {
  const router = useRouter();
  const { userId } = useUserId();

  // výber rozsahu ako pri WeeklyLoad (2/4/8/12 týždňov)
  const [weeks, setWeeks] = useState<number>(8);
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const days = weeks * 7;
      const res = await fetch(`${API_URL}/recovery/${userId}?days=${days}`);
      const json = await res.json().catch(() => ({}));
      if (json?.success && Array.isArray(json?.data))
        setRows(json.data as Row[]);
      else setRows([]);
    })();
  }, [userId, weeks]);

  // os X: zoradíme dni chronologicky (ASC) a až potom mapujeme
  const points: DayPoint[] = useMemo(() => {
    const sorted = [...rows].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    return sorted.map((r) => ({
      date: isoDate(r.date),
      value: r.RHR_bpm ?? null,
      comment: r.comments ?? null,
    }));
  }, [rows]);

  const labelsISO = useMemo(() => points.map((p) => p.date), [points]);
  const values = useMemo(() => points.map((p) => p.value), [points]);

  // rolling baseline = priemer z predchádzajúcich 14 dní (bez aktuálneho dňa)
  const baseline = useMemo(() => rollingMean(values, 14), [values]);
  const { lower, upper } = useMemo(
    () => bandsAround(baseline, 0.05),
    [baseline]
  );

  // tooltip: k dátumu doplníme aj komentár (ak je) len pre dataset "Resting HR"
  const commentsMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of points) if (p.comment) m.set(p.date, p.comment);
    return m;
  }, [points]);

  const data = useMemo(
    () => ({
      labels: labelsISO,
      datasets: [
        // 1) spodná hranica pásma (skrytá čiara – bez legendy)
        {
          type: "line" as const,
          label: "_bandLower",
          data: lower,
          borderWidth: 0,
          pointRadius: 0,
          hitRadius: 0,
        },
        // 2) horná hranica pásma – vyplní priestor po predchádzajúcu
        {
          type: "line" as const,
          label: "_bandUpper",
          data: upper,
          borderWidth: 0,
          pointRadius: 0,
          hitRadius: 0,
          fill: "-1", // vyplň k predošlej dátasade (lower)
          backgroundColor: "rgba(34,197,94,0.12)", // zelená jemne
        },
        // 3) baseline
        {
          type: "line" as const,
          label: "Baseline (14d priemer)",
          data: baseline,
          borderColor: "#22C55E",
          backgroundColor: "#22C55E",
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.25,
          order: 10,
        },
        // 4) skutočný RHR
        {
          type: "line" as const,
          label: "Resting HR",
          data: values,
          borderColor: "#F59E0B",
          backgroundColor: "#F59E0B",
          borderWidth: 2,
          pointRadius: 2,
          tension: 0.2,
          order: 20,
        },
      ],
    }),
    [labelsISO, lower, upper, baseline, values]
  );

  const options = useMemo(
    () =>
      buildRecoveryLineOptions({
        labelsISO,
        yTitle: "bpm",
        tooltipTitleForIndex: (i) => {
          const iso = labelsISO[i] ?? "";
          return new Date(iso + "T00:00:00").toLocaleDateString("sk-SK");
        },
        tooltipLabelForItem: (ctx) => {
          const di = ctx.dataIndex as number;
          const label = ctx.dataset?.label as string;
          // len pre "Resting HR" pripájame komentár
          if (label === "Resting HR") {
            const iso = labelsISO[di] ?? "";
            const c = commentsMap.get(iso);
            const base = `RHR: ${Math.round(Number(ctx.parsed.y))} bpm`;
            return c ? `${base} — ${c}` : base;
          }
          if (label?.startsWith("Baseline")) {
            return `Baseline: ${Math.round(Number(ctx.parsed.y))} bpm`;
          }
          return ""; // skry pre band datasets
        },
        // neukazuj položky tooltipu pre band dataset-y
        tooltipFilter: (item) => !(item.dataset?.label || "").startsWith("_"),
      }),
    [labelsISO, commentsMap]
  );

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded shadow">
      {/* Header + späť */}
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
          <button
            onClick={() => router.back()}
            className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 text-sm"
          >
            Späť
          </button>
        </div>
      </div>

      {/* pevná výška – nič nepretečie; šírka sa prispôsobí kontajneru */}
      <div style={{ height: THEME.chart.weeklyHeight || 360 }}>
        <Line data={data} options={options} />
      </div>
    </div>
  );
}
