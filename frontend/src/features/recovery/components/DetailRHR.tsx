// src/features/recovery/components/DetailRHR.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Chart as LineChart } from "react-chartjs-2";
import type { ChartData } from "chart.js";
import { ensureChartJSRegistered } from "@/shared/charts/register";
import { API_URL } from "@/shared/config";
import { useUserId } from "@/shared/hooks/useUserId";
import { THEME } from "@/shared/theme/tokens";

// ✅ spoločné utily (aliasy už máš v utils/recovery.ts)
import {
  isoDate as toISODate,
  makeRollingBaseline,
} from "@/shared/utils/recovery";

// ✅ spoločné Chart.js options pre recovery trendy
import { buildRecoveryLineOptions } from "@/shared/charts/optionsRecovery";

ensureChartJSRegistered();

type Row = {
  date: string;
  RHR_bpm: number | null;
  note?: string | null; // ak máš v tabuľke komentáre
};

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

      const arr: Row[] = Array.isArray(json?.data) ? json.data : [];
      // normalizácia a zoradenie podľa dňa (vzostupne)
      const norm = arr
        .map((r) => ({
          date: toISODate(r.date),
          RHR_bpm: r.RHR_bpm ?? null,
          note: (r as any)?.note ?? (r as any)?.r_note ?? null,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      setRows(norm);
    })();
  }, [userId, weeks]);

  // x-ová os: každý DEŇ (ale labely len v pondelky)
  const labelsISO = useMemo(() => rows.map((r) => r.date), [rows]);

  // hodnoty + komentáre
  const rhr = useMemo<(number | null)[]>(
    () => rows.map((r) => (typeof r.RHR_bpm === "number" ? r.RHR_bpm : null)),
    [rows]
  );
  const commentsMap = useMemo(
    () => new Map(rows.map((r) => [r.date, r.note ?? ""])),
    [rows]
  );

  // ✅ rolling baseline (14d) + ±5 % pásmo
  const { baseline, lower, upper } = useMemo(
    () => makeRollingBaseline(rhr, 14, 0.05),
    [rhr]
  );

  // datasets – fill medzi lower/upper (bledozelené pozadie)
  const data: ChartData<"line", (number | null)[], string> = useMemo(
    () => ({
      labels: labelsISO,
      datasets: [
        {
          label: "Baseline −5%",
          data: lower,
          borderColor: "#16a34a",
          pointRadius: 0,
          spanGaps: true,
          borderWidth: 1,
        },
        {
          label: "Baseline +5%",
          data: upper,
          borderColor: "#16a34a",
          pointRadius: 0,
          spanGaps: true,
          borderWidth: 1,
          fill: {
            target: "-1",
            above: "rgba(34,197,94,0.12)",
            below: "rgba(34,197,94,0.12)",
          },
        },
        {
          label: "Baseline (14d priemer)",
          data: baseline,
          borderColor: "#22c55e",
          pointRadius: 0,
          spanGaps: true,
          borderDash: [4, 3],
          borderWidth: 2,
        },
        {
          label: "Resting HR",
          data: rhr,
          borderColor: "#fbbf24",
          backgroundColor: "#fbbf24",
          pointRadius: 2,
          tension: 0.25,
          spanGaps: true,
        },
      ],
    }),
    [labelsISO, lower, upper, baseline, rhr]
  );

  // options – spoločné, s 55° labelmi a týždenným gridom
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
          // datasetIndex 3 = „Resting HR“ (pozri poradie v datasets)
          if (ctx.datasetIndex === 3) {
            const iso = labelsISO[ctx.dataIndex] ?? "";
            const v = typeof ctx.parsed?.y === "number" ? Math.round(ctx.parsed.y) : null;
            const base = baseline[ctx.dataIndex];
            const baseTxt =
              typeof base === "number" ? ` · Baseline: ${Math.round(base)} bpm` : "";
            const comment = commentsMap.get(iso);
            const commentTxt = comment ? ` · ${comment}` : "";
            return v == null ? "" : `RHR: ${v} bpm${baseTxt}${commentTxt}`;
          }
          // ostatné labely nech sú stručné
          const val =
            typeof ctx.parsed?.y === "number" ? Math.round(ctx.parsed.y) : null;
          return val == null ? "" : `${ctx.dataset?.label}: ${val}`;
        },
        // zobrazuj všetko (alebo by si mohol filtrovať len na datasetIndex === 3)
        // tooltipFilter: (item) => item.datasetIndex === 3,
      }),
    [labelsISO, baseline, commentsMap]
  );

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded shadow">
      {/* header */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="text-lg font-semibold">Detail – Resting HR</h2>
        <div className="text-xs">
          <span className="opacity-70 mr-2">Rozsah:</span>
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

      {/* fixná výška; nič nepretečie */}
      <div style={{ height: THEME.chart.weeklyHeight }}>
        <LineChart type="line" data={data} options={options} />
      </div>
    </div>
  );
}
