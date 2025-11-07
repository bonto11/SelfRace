// src/features/recovery/components/TrendHRV.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Line } from "react-chartjs-2";
import type { ChartData, ChartOptions } from "chart.js";
import { ensureChartJSRegistered } from "@/shared/charts/register";
import { THEME } from "@/shared/theme/tokens";
import { rollingMean, bandsAround, wrapToLines } from "@/shared/utils/recovery";
import { buildRecoveryLineOptions } from "@/shared/charts/optionsRecovery";
import { useRecoveryData } from "@/shared/components/dataProviders/RecoveryDataProvider";
import LoadingSpinner from "@/shared/components/ui/LoadingSpinner";
import { CARD, SCROLL_X } from "@/shared/ui/classes";
import { inputClass } from "@/shared/ui";

ensureChartJSRegistered();

export default function TrendHRV() {
  const { rows: all } = useRecoveryData();
  const [weeks, setWeeks] = useState<number>(2);
  const [loading, setLoading] = useState<boolean>(false);

  const DAY_PX_PER_LABEL = THEME.chart?.pxPerLabel ?? 26;

  const COLOR = {
    main: THEME.chart?.linePrimary ?? "#FFFFFF",
    bandFill: THEME.chart?.bandFill ?? "rgba(16,185,129,0.15)",
  };

  useEffect(() => { setLoading(true); }, [weeks]);

  const days = weeks * 7;
  const rows = useMemo(() => (days > 0 ? all.slice(-days) : all), [all, days]);

  useEffect(() => {
    const t = requestAnimationFrame(() => setLoading(false));
    return () => cancelAnimationFrame(t);
  }, [rows]);

  const labelsISO = useMemo(() => rows.map((r) => r.date), [rows]);

  // HRV dáta
  const hrv = useMemo(
    () => rows.map((r) => (typeof r.HRV_avg_ms === "number" ? r.HRV_avg_ms : NaN)),
    [rows]
  );

  // Baseline (len na výpočet pásma ±5 %, čiaru nekreslíme)
  const baselineArr = useMemo(
    () => rollingMean(rows.map((r) => (typeof r.HRV_avg_ms === "number" ? r.HRV_avg_ms : null)), 14),
    [rows]
  );
  const { lower, upper } = useMemo(() => bandsAround(baselineArr, 0.05), [baselineArr]);

  const comments = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) if (r.comments) m.set(r.date, r.comments);
    return m;
  }, [rows]);

  const data: ChartData<"line", number[], string> = useMemo(() => {
    const toNum = (xs: (number | null)[]) => xs.map((v) => (typeof v === "number" ? v : NaN));
    return {
      labels: labelsISO,
      datasets: [
        // zelené pásmo okolo baseline
        {
          type: "line" as const,
          label: "Baseline −5%",
          data: toNum(lower),
          borderColor: "rgba(0,0,0,0)",
          backgroundColor: COLOR.bandFill,
          pointRadius: 0,
          borderWidth: 0,
          tension: 0.2,
          order: 1,
        },
        {
          type: "line" as const,
          label: "Baseline +5%",
          data: toNum(upper),
          borderColor: "rgba(0,0,0,0)",
          backgroundColor: COLOR.bandFill,
          pointRadius: 0,
          borderWidth: 0,
          tension: 0.2,
          fill: "-1" as const,
          order: 1,
        },
        // hlavná línia (bez baseline čiary)
        {
          type: "line" as const,
          label: "HRV (RMSSD)",
          data: hrv,
          borderColor: COLOR.main,
          backgroundColor: COLOR.main,
          pointRadius: 3,
          borderWidth: 2,
          tension: 0.2,
          spanGaps: true,
          order: 2,
        },
      ],
    };
  }, [labelsISO, lower, upper, hrv, COLOR.bandFill, COLOR.main]);

  const options: ChartOptions<"line"> = useMemo(
    () =>
      buildRecoveryLineOptions({
        labelsISO,
        yTitle: "ms",
        tooltipTitleForIndex: (i) =>
          new Date((labelsISO[i] ?? "") + "T00:00:00").toLocaleDateString(THEME.i18n?.dateLocale ?? "sk-SK"),
        tooltipLabelForItem: (ctx): string | string[] => {
          const idx = ctx.dataIndex ?? 0;
          const out: string[] = [];
          if (ctx.datasetIndex === 2) {
            const v = hrv[idx];
            if (Number.isFinite(v)) out.push(`HRV: ${Math.round(v as number)} ms`);
            const c = comments.get(labelsISO[idx] ?? "");
            if (c) out.push(...wrapToLines(c, 44));
          }
          return out.length ? out : `${ctx.dataset?.label ?? ""}: ${ctx.formattedValue ?? ""}`;
        },
        // tooltip iba pre hlavnú líniu
        tooltipFilter: (item) => item.datasetIndex === 2,
      }),
    [labelsISO, hrv, comments]
  );

  const minWidth = Math.max(360, Math.round(labelsISO.length * DAY_PX_PER_LABEL));

  return (
    <div className={`${CARD} relative`}>
      {/* HEADER – rovnaké wrappy/paddingy ako ostatné trendy */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold">HR Variability</h2>
        <select
          value={weeks}
          onChange={(e) => setWeeks(Number(e.target.value))}
          className={`${inputClass} h-8 text-xs w-[132px]`}
        >
          <option value={2}>2 týždne</option>
          <option value={4}>4 týždne</option>
          <option value={8}>8 týždňov</option>
          <option value={12}>12 týždňov</option>
        </select>
      </div>

      {/* BODY – flush + horizontal scroll */}
      <div
        className={`${SCROLL_X} min-w-0`}
        style={{ WebkitOverflowScrolling: "touch", contain: "inline-size" }}
      >
        <div className="relative" style={{ height: THEME.chart.weeklyHeight }}>
          {loading && (
            <div className="absolute inset-0 grid place-items-center z-10 bg-black/10">
              <LoadingSpinner size="trend" />
            </div>
          )}
          <div style={{ minWidth, height: "100%", maxWidth: "none" }}>
            <Line data={data} options={options} />
          </div>
        </div>
      </div>
    </div>
  );
}