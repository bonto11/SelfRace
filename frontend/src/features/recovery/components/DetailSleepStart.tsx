"use client";

import { useMemo, useState } from "react";
import { Line } from "react-chartjs-2";
import type { ChartData } from "chart.js";
import Link from "next/link";
import { ensureChartJSRegistered } from "@/shared/charts/register";
import { THEME } from "@/shared/theme/tokens";
import {
  minutesToHHMM,
  wrapToLines,
  HHMMToMinutes,
} from "@/shared/utils/recovery";
import { buildRecoveryLineOptions } from "@/shared/charts/optionsRecovery";
import { useRecoveryData } from "@/features/recovery/data/RecoveryDataProvider";

ensureChartJSRegistered();

export default function DetailSleepStart() {
  const { rows: all } = useRecoveryData();
  const [weeks, setWeeks] = useState<number>(2); // 2/4/8/12

  // vždy orež na posledných N dní z provideru
  const days = weeks * 7;
  const rows = useMemo(() => (days > 0 ? all.slice(-days) : all), [all, days]);

  // osi + hodnoty
  const labelsISO = useMemo(() => rows.map((r) => r.date), [rows]);
  const startMin = useMemo(
    () =>
      rows.map((r) => {
        const m = r.sleep_start_time ? HHMMToMinutes(r.sleep_start_time) : null;
        return typeof m === "number" ? m : NaN; // Chart.js chce čísla
      }),
    [rows]
  );

  // fixné odporúčané pásmo: 22:00–23:00 -> 1320–1380 min
  const lowerBand = useMemo(() => rows.map(() => 22 * 60), [rows]); // 1320
  const upperBand = useMemo(() => rows.map(() => 23 * 60), [rows]); // 1380

  // komentáre
  const comments = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) if (r.comments) m.set(r.date, r.comments);
    return m;
  }, [rows]);

  // datasets
  const data: ChartData<"line", number[], string> = useMemo(() => {
    const bandLower = {
      type: "line" as const,
      label: "22:00–23:00 (odporúčané) – spodná",
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
      label: "22:00–23:00 (odporúčané) – horná",
      data: upperBand,
      borderColor: "rgba(16,185,129,0)",
      backgroundColor: "rgba(16,185,129,0.15)",
      pointRadius: 0,
      borderWidth: 0,
      tension: 0.2,
      fill: "-1" as const,
      order: 1,
    };
    const startLine = {
      type: "line" as const,
      label: "Sleep start",
      data: startMin,
      borderColor: "#06b6d4",
      backgroundColor: "#06b6d4",
      pointRadius: 3,
      borderWidth: 2,
      tension: 0.2,
      spanGaps: true,
      order: 2,
    };

    return { labels: labelsISO, datasets: [bandLower, bandUpper, startLine] };
  }, [labelsISO, lowerBand, upperBand, startMin]);

  // options – spoločné (x: len pondelky, 55°; y: HH:MM)
  const options = useMemo(
    () =>
      buildRecoveryLineOptions({
        labelsISO,
        yTitle: "čas",
        yTickFormatter: (v: number) => minutesToHHMM(v),
        tooltipTitleForIndex: (i) => {
          const iso = labelsISO[i] ?? "";
          return new Date(iso + "T00:00:00").toLocaleDateString("sk-SK");
        },
        tooltipLabelForItem: (ctx): string => {
          const idx = ctx.dataIndex ?? 0;
          const lines: string[] = [];

          if (ctx.datasetIndex === 2) {
            const v = startMin[idx];
            if (Number.isFinite(v))
              lines.push(`Zaspal: ${minutesToHHMM(v as number)}`);
            const c = comments.get(labelsISO[idx] ?? "");
            if (c) lines.push(...wrapToLines(c, 44));
          }

          if (!lines.length)
            return `${ctx.dataset?.label ?? ""}: ${ctx.formattedValue ?? ""}`;
          return lines.join("\n");
        },
        tooltipFilter: (item) => item.datasetIndex === 2, // zobraz len hlavnú krivku
      }),
    [labelsISO, startMin, comments]
  );

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded shadow">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="text-lg font-semibold">Detail — Sleep Start</h2>
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
