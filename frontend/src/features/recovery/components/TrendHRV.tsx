// src/features/recovery/components/TrendHRV.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Line } from "react-chartjs-2";
import type { ChartData, ChartOptions, Plugin } from "chart.js";
import { ensureChartJSRegistered } from "@/shared/charts/register";
import { THEME } from "@/shared/theme/tokens";
import { rollingMean, bandsAround, wrapToLines } from "@/shared/utils/recovery";
import { buildRecoveryLineOptions } from "@/shared/charts/optionsRecovery";
import { useRecoveryData } from "@/shared/components/dataProviders/RecoveryDataProvider";
import LoadingSpinner from "@/shared/components/ui/LoadingSpinner";
import { CARD, SCROLL_X } from "@/shared/ui/classes";
import { inputClass } from "@/shared/ui";

ensureChartJSRegistered();

function iso(d: Date) {
  const z = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  return z.toISOString().slice(0, 10);
}

function dateSeq(startISO: string, endISO: string): string[] {
  const out: string[] = [];
  const start = new Date(startISO + "T00:00:00");
  const end = new Date(endISO + "T00:00:00");
  for (let d = start; d <= end; d.setUTCDate(d.getUTCDate() + 1)) out.push(iso(d));
  return out;
}

export default function TrendHRV() {
  const { rows: all } = useRecoveryData();
  const [weeks, setWeeks] = useState<number>(2);
  const [loading, setLoading] = useState<boolean>(false);

  const DAY_PX_PER_LABEL = THEME.chart?.pxPerLabel ?? 26;

  const COLOR = {
    main: THEME.chart?.linePrimary ?? "#FFFFFF",
    bandFill: THEME.chart?.bandFill ?? "rgba(16,185,129,0.15)",
    missing: THEME.chart?.missing ?? "#ef4444", // tailwind red-500
  };

  useEffect(() => {
    setLoading(true);
  }, [weeks]);

  const days = weeks * 7;

  // --- 1) Denzifikácia na denné kroky (vrátane chýbajúcich dní) ---
  // koniec okna = posledný známy záznam, fallback = dnešok
  const endISO = useMemo(() => all.at(-1)?.date ?? iso(new Date()), [all]);
  const startISO = useMemo(() => {
    const d = new Date(endISO + "T00:00:00");
    d.setUTCDate(d.getUTCDate() - (days - 1));
    return iso(d);
  }, [endISO, days]);

  // indexovanie pôvodných riadkov podľa dátumu
  const byDate = useMemo(() => {
    const m = new Map<string, (typeof all)[number]>();
    for (const r of all) m.set(r.date, r);
    return m;
  }, [all]);

  // konečné štítky = každý deň v intervale
  const labelsISO = useMemo(() => dateSeq(startISO, endISO), [startISO, endISO]);

  // --- 2) HRV dáta + komentáre na zhustenej osi ---
  const hrv = useMemo(
    () =>
      labelsISO.map((d) => {
        const rec = byDate.get(d);
        return typeof rec?.HRV_avg_ms === "number" ? rec.HRV_avg_ms : NaN;
      }),
    [labelsISO, byDate]
  );

  const comments = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of labelsISO) {
      const c = byDate.get(d)?.comments;
      if (c) m.set(d, c);
    }
    return m;
  }, [labelsISO, byDate]);

  // Baseline pre pásmo (bez samotnej baseline čiary)
  const baselineArr = useMemo(
    () => rollingMean(hrv.map((v) => (Number.isFinite(v) ? (v as number) : null)), 14),
    [hrv]
  );
  const { lower, upper } = useMemo(() => bandsAround(baselineArr, 0.05), [baselineArr]);

  // --- 3) Missing mask pre plugin (červené X) ---
  const missingIdx = useMemo(() => hrv.map((v) => !Number.isFinite(v)), [hrv]);

  // --- 4) Datasety ---
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

  // --- 5) Options + tooltipy (iba pre hlavnú líniu) ---
  const options: ChartOptions<"line"> = useMemo(
    () =>
      buildRecoveryLineOptions({
        labelsISO,
        yTitle: "ms",
        tooltipTitleForIndex: (i) =>
          new Date((labelsISO[i] ?? "") + "T00:00:00").toLocaleDateString(
            THEME.i18n?.dateLocale ?? "sk-SK"
          ),
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
        tooltipFilter: (item) => item.datasetIndex === 2, // tooltip iba pre hlavnú líniu
      }),
    [labelsISO, hrv, comments]
  );

  // --- 6) Plugin: červené X pre chýbajúce dni (overlay, bez vplyvu na škálu) ---
  const missingXPlugin: Plugin<"line"> = useMemo(
    () => ({
      id: "missing-x",
      afterDatasetsDraw(chart) {
        const { ctx, chartArea, scales } = chart;
        if (!chartArea || !scales?.x) return;
        const xScale = scales.x as any;

        ctx.save();
        ctx.strokeStyle = COLOR.missing;
        ctx.lineWidth = 2;

        // umiestnime X tesne pod horný okraj plochy grafu
        const y = chartArea.top + 10;
        const size = 6;

        for (let i = 0; i < missingIdx.length; i++) {
          if (!missingIdx[i]) continue;
          const x = xScale.getPixelForValue(i);
          if (!Number.isFinite(x)) continue;

          ctx.beginPath();
          ctx.moveTo(x - size, y - size);
          ctx.lineTo(x + size, y + size);
          ctx.moveTo(x + size, y - size);
          ctx.lineTo(x - size, y + size);
          ctx.stroke();
        }
        ctx.restore();
      },
    }),
    [missingIdx, COLOR.missing]
  );

  useEffect(() => {
    const t = requestAnimationFrame(() => setLoading(false));
    return () => cancelAnimationFrame(t);
  }, [labelsISO.join("|")]); // po zmene okna/labelov vypneme spinner

  const minWidth = Math.max(360, Math.round(labelsISO.length * DAY_PX_PER_LABEL));

  return (
    <div className={`${CARD} relative`}>
      {/* HEADER */}
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
            <Line data={data} options={options} plugins={[missingXPlugin]} />
          </div>
        </div>
      </div>
    </div>
  );
}