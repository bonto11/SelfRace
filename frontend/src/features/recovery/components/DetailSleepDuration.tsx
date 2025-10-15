"use client";

import { useMemo, useState } from "react";
import { Line } from "react-chartjs-2";
import type { ChartData } from "chart.js";
import Link from "next/link";

import { ensureChartJSRegistered } from "@/shared/charts/register";
import { THEME } from "@/shared/theme/tokens";

import { minutesToHHMM, wrapToLines } from "@/shared/utils/recovery";
import { buildRecoveryLineOptions } from "@/shared/charts/optionsRecovery";

import { useRecoveryData } from "@/features/recovery/data/RecoveryDataContext";

ensureChartJSRegistered();

export default function DetailSleepDuration() {
  const { rows: all } = useRecoveryData();
  const [weeks, setWeeks] = useState<number>(2); // 2/4/8/12

  // vždy orež na posledných N dní z provideru
  const days = weeks * 7;
  const rows = useMemo(() => (days > 0 ? all.slice(-days) : all), [all, days]);

  const labelsISO = useMemo(() => rows.map((r) => r.date), [rows]);
  const sleepMin = useMemo(
    () =>
      rows.map((r) =>
        typeof r.sleep_duration_min === "number" ? r.sleep_duration_min : NaN
      ),
    [rows]
  );

  // fixné odporúčané pásmo 7–9h (420–540 min)
  const lowerBand = useMemo(() => rows.map(() => 420), [rows]);
  const upperBand = useMemo(() => rows.map(() => 540), [rows]);

  // komentáre
  const comments = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) if (r.comments) m.set(r.date, r.comments);
    return m;
  }, [rows]);

  const data: ChartData<"line", number[], string> = useMemo(() => {
    const bandLower = {
      type: "line" as const,
      label: "7–9h (odporúčané) – spodná",
      data: lowerBand,
      borderColor: "rgba(16,185,129,0)",
      backgroundColor: "rgba(16,185,129,0.15)",
      pointRadius: 0,
      borderWidth: 0,
      tension: 0.2,
      order: 1,
    };
    const bandUpper = {
      type: "line" as const,
      label: "7–9h (odporúčané) – horná",
      data: upperBand,
      borderColor: "rgba(16,185,129,0)",
      backgroundColor: "rgba(16,185,129,0.15)",
      pointRadius: 0,
      borderWidth: 0,
      tension: 0.2,
      fill: "-1" as const,
      order: 1,
    };
    const sleepLine = {
      type: "line" as const,
      label: "Sleep duration",
      data: sleepMin,
      borderColor: "#8b5cf6",
      backgroundColor: "#8b5cf6",
      pointRadius: 3,
      borderWidth: 2,
      tension: 0.2,
      spanGaps: true,
      order: 2,
    };

    return { labels: labelsISO, datasets: [bandLower, bandUpper, sleepLine] };
  }, [labelsISO, lowerBand, upperBand, sleepMin]);

  const options = useMemo(
    () =>
      buildRecoveryLineOptions({
        labelsISO,
        yTitle: "min",
        yTickFormatter: (v: number) => minutesToHHMM(v),
        tooltipTitleForIndex: (i) => {
          const iso = labelsISO[i] ?? "";
          return new Date(iso + "T00:00:00").toLocaleDateString("sk-SK");
        },
        tooltipLabelForItem: (ctx): string => {
          const idx = ctx.dataIndex ?? 0;
          const lines: string[] = [];

          if (ctx.datasetIndex === 2) {
            const v = sleepMin[idx];
            if (Number.isFinite(v))
              lines.push(`Spánok: ${minutesToHHMM(v as number)}`);
            const c = comments.get(labelsISO[idx] ?? "");
            if (c) lines.push(...wrapToLines(c, 44));
          }
          // fallback – ak by klikol mimo hlavného datasetu
          if (!lines.length)
            return `${ctx.dataset?.label ?? ""}: ${ctx.formattedValue ?? ""}`;
          return lines.join("\n");
        },
        tooltipFilter: (item) => item.datasetIndex === 2, // zobraz len hlavnú krivku
      }),
    [labelsISO, sleepMin, comments]
  );

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded shadow">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="text-lg font-semibold">Detail — Sleep Duration</h2>
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
