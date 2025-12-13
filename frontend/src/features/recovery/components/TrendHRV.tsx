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
    missing: THEME.chart?.missing ?? "#ef4444", // red-500
  };

  useEffect(() => { setLoading(true); }, [weeks]);

  const days = weeks * 7;

  // --- denzifikácia osi X na denné kroky ---
  const endISO = useMemo(() => all.at(-1)?.date ?? iso(new Date()), [all]);
  const startISO = useMemo(() => {
    const d = new Date(endISO + "T00:00:00");
    d.setUTCDate(d.getUTCDate() - (days - 1));
    return iso(d);
  }, [endISO, days]);

  const byDate = useMemo(() => {
    const m = new Map<string, (typeof all)[number]>();
    for (const r of all) m.set(r.date, r);
    return m;
  }, [all]);

  const labelsISO = useMemo(() => dateSeq(startISO, endISO), [startISO, endISO]);

  // --- HRV séria na zhustenej osi ---
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

  // --- baseline pásmo (±5 %) ---
  const baselineArr = useMemo(
    () => rollingMean(hrv.map((v) => (Number.isFinite(v) ? (v as number) : null)), 14),
    [hrv]
  );
  const { lower, upper } = useMemo(() => bandsAround(baselineArr, 0.05), [baselineArr]);

  // --- chýbajúce dni ---
  const missingIdx = useMemo(() => hrv.map((v) => !Number.isFinite(v)), [hrv]);

  // Y-pozícia pre chýbajúce (lineárna interpolácia; okraje carry-forward/back)
  const missingY = useMemo(() => {
    const n = hrv.length;
    const out = new Array<number | null>(n).fill(null);

    // najbližší známy index sprava
    const nextKnown: number[] = new Array(n).fill(-1);
    let last = -1;
    for (let i = n - 1; i >= 0; i--) {
      if (Number.isFinite(hrv[i])) last = i;
      nextKnown[i] = last;
    }

    // zľava a výpočet
    let prev = -1;
    for (let i = 0; i < n; i++) {
      if (Number.isFinite(hrv[i])) { prev = i; continue; }
      const nxt = nextKnown[i];
      let y: number | null = null;
      if (prev !== -1 && nxt !== -1) {
        const vp = hrv[prev] as number;
        const vn = hrv[nxt] as number;
        const t = (i - prev) / (nxt - prev);
        y = vp + (vn - vp) * t;
      } else if (prev !== -1) {
        y = hrv[prev] as number;
      } else if (nxt !== -1) {
        y = hrv[nxt] as number;
      } else {
        y = null;
      }
      out[i] = y;
    }
    return out;
  }, [hrv]);

  // --- datasety ---
  const data: ChartData<"line", number[], string> = useMemo(() => {
    const toNum = (xs: (number | null)[]) => xs.map((v) => (typeof v === "number" ? v : NaN));
    return {
      labels: labelsISO,
      datasets: [
        // pásmo okolo baseline
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

        // HRV línia – rovné segmenty kvôli presnému zarovnaniu
        {
          type: "line" as const,
          label: "HRV (RMSSD)",
          data: hrv,
          borderColor: COLOR.main,
          backgroundColor: COLOR.main,
          pointRadius: 3,
          borderWidth: 2,
          tension: 0,        // <<< dôležité
          spanGaps: true,
          order: 2,
        },

        // chýbajúce dni – dataset len pre tooltip/hit-detekciu
        {
          type: "line" as const,
          label: "Missing",
          data: missingY.map((y, i) => (missingIdx[i] && typeof y === "number" ? y : NaN)),
          showLine: false,
          pointStyle: "circle",
          pointRadius: 0,          // vizuál kreslí plugin (navrch)
          pointHitRadius: 12,      // ale nech sa dá chytiť tooltip
          pointBackgroundColor: COLOR.missing,
          pointBorderColor: COLOR.missing,
          pointBorderWidth: 2,
          borderWidth: 0,
          order: 999,
          clip: false as any,
        },
      ],
    };
  }, [labelsISO, lower, upper, hrv, missingY, missingIdx, COLOR.bandFill, COLOR.main, COLOR.missing]);

  // --- plugin: prekreslí Missing kruhy úplne navrch, v správnych XY ---
  const drawMissingOnTop: Plugin<"line"> = useMemo(
    () => ({
      id: "draw-missing-on-top",
      afterDatasetsDraw(chart) {
        const dsIndex = chart.data.datasets.findIndex((d) => d.label === "Missing");
        if (dsIndex < 0) return;
        const meta = chart.getDatasetMeta(dsIndex);
        const ctx = chart.ctx;
        ctx.save();
        ctx.fillStyle = COLOR.missing;
        ctx.strokeStyle = COLOR.missing;
        ctx.lineWidth = 2;
        // meta.data obsahuje PointElement-y pre tie indexy, kde nie je NaN
        for (const el of meta.data as any[]) {
          if (!el || el.skip) continue;
          const { x, y } = el.tooltipPosition(true);
          ctx.beginPath();
          ctx.arc(x, y, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
        ctx.restore();
      },
    }),
    [COLOR.missing]
  );

  // --- options + tooltippy (HRV aj Missing) ---
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
          const label = ctx.dataset?.label ?? "";
          if (label === "HRV (RMSSD)") {
            const v = hrv[idx];
            const out: string[] = [];
            if (Number.isFinite(v)) out.push(`HRV: ${Math.round(v as number)} ms`);
            const c = comments.get(labelsISO[idx] ?? "");
            if (c) out.push(...wrapToLines(c, 44));
            return out.length ? out : "HRV: –";
          }
          if (label === "Missing") return "Bez záznamu";
          return "";
        },
        tooltipFilter: (item) => {
          const l = item.dataset.label ?? "";
          return l === "HRV (RMSSD)" || l === "Missing";
        },
      }),
    [labelsISO, hrv, comments]
  );

  useEffect(() => {
    const t = requestAnimationFrame(() => setLoading(false));
    return () => cancelAnimationFrame(t);
  }, [labelsISO.join("|")]);

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
            <Line data={data} options={options} plugins={[drawMissingOnTop]} />
          </div>
        </div>
      </div>
    </div>
  );
}