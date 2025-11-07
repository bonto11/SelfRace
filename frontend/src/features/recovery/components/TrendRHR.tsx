// src/features/recovery/components/DetailRHR.tsx
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

// malá utilitka: HEX -> rgba(...) s danou alfou (bez zásahov do iných súborov)
function hexToRgba(hex?: string, alpha = 0.15) {
  if (!hex) return `rgba(255,255,255,${alpha})`;
  const h = hex.replace("#", "");
  const bigint = parseInt(h.length === 3
    ? h.split("").map((c) => c + c).join("")
    : h, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

export default function DetailRHR() {
  const { rows: all } = useRecoveryData();
  const [weeks, setWeeks] = useState<number>(2);
  const [loading, setLoading] = useState<boolean>(false);

  // horizontálna šírka podľa dní (nech sa správa rovnako ako ostatné trendy)
  const DAY_PX_PER_LABEL = THEME.chart?.pxPerLabel ?? 26;

  // farby z THEME
  const COLOR = {
    main: THEME.chart?.linePrimary ?? "#FFFFFF",
    baseline: THEME.chart?.lineSecondary ?? "#FDE047",
    bandFill: hexToRgba(THEME.chart?.positive, 0.15), // jemné zelené pásmo
  };

  useEffect(() => { setLoading(true); }, [weeks]);

  const days = weeks * 7;
  const rows = useMemo(() => (days > 0 ? all.slice(-days) : all), [all, days]);

  useEffect(() => {
    const t = requestAnimationFrame(() => setLoading(false));
    return () => cancelAnimationFrame(t);
  }, [rows]);

  const labelsISO = useMemo(() => rows.map((r) => r.date), [rows]);
  const rhr = useMemo(
    () => rows.map((r) => (typeof r.RHR_bpm === "number" ? r.RHR_bpm : NaN)),
    [rows]
  );

  const baselineArr = useMemo(
    () => rollingMean(rows.map((r) => (typeof r.RHR_bpm === "number" ? r.RHR_bpm : null)), 14),
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
        // band −5 %
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
        // band +5 % (fill: "-1" vyplní medzi touto a predošlou dataset)
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
        // baseline
        {
          type: "line" as const,
          label: "Baseline (14d priemer)",
          data: toNum(baselineArr),
          borderColor: COLOR.baseline,
          backgroundColor: COLOR.baseline,
          pointRadius: 0,
          borderWidth: 2,
          tension: 0.25,
          spanGaps: true,
          order: 2,
        },
        // hlavná línia
        {
          type: "line" as const,
          label: "Resting HR",
          data: rhr,
          borderColor: COLOR.main,
          backgroundColor: COLOR.main,
          pointRadius: 3,
          borderWidth: 2,
          tension: 0.2,
          spanGaps: true,
          order: 3,
        },
      ],
    };
  }, [labelsISO, lower, upper, baselineArr, rhr, COLOR.bandFill, COLOR.baseline, COLOR.main]);

  const options: ChartOptions<"line"> = useMemo(
    () =>
      buildRecoveryLineOptions({
        labelsISO,
        yTitle: "bpm",
        // buildRecoveryLineOptions už používa THEME.chart.grid / gridSoft / ticks, takže netreba nič násilne prepisovať
        tooltipTitleForIndex: (i) =>
          new Date((labelsISO[i] ?? "") + "T00:00:00").toLocaleDateString(THEME.i18n?.dateLocale ?? "sk-SK"),
        tooltipLabelForItem: (ctx): string | string[] => {
          const idx = ctx.dataIndex ?? 0;
          const out: string[] = [];
          if (ctx.datasetIndex === 3) {
            const v = rhr[idx];
            if (Number.isFinite(v)) out.push(`RHR: ${Math.round(v as number)} bpm`);
            const c = comments.get(labelsISO[idx] ?? "");
            if (c) out.push(...wrapToLines(c, 44));
          }
          if (ctx.datasetIndex === 2) {
            const b = baselineArr[idx];
            if (Number.isFinite(b as number)) out.push(`Baseline: ${Math.round(b as number)} bpm`);
          }
          return out.length ? out : `${ctx.dataset?.label ?? ""}: ${ctx.formattedValue ?? ""}`;
        },
        tooltipFilter: (item) => item.datasetIndex === 2 || item.datasetIndex === 3,
      }),
    [labelsISO, rhr, baselineArr, comments]
  );

  const minWidth = Math.max(360, Math.round(labelsISO.length * DAY_PX_PER_LABEL));

  return (
    <div className={`${CARD} relative`}>
      {/* HEADER */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold">Resting HR</h2>
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