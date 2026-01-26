// src/features/recovery/components/DetailSleepStart.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Line } from "react-chartjs-2";
import type { ChartData, ChartOptions, Plugin } from "chart.js";

import { ensureChartJSRegistered } from "@/app/shared/charts/register";
import { THEME } from "@/app/shared/theme/tokens";
import { wrapToLines } from "@/app/shared/utils/recovery";
import {
  minutesToHHMM,
  HHMMToMinutes,
  dateSeq,
  iso,
} from "@/app/shared/utils/time";
import { buildRecoveryLineOptions } from "@/app/shared/charts/optionsRecovery";
import { useRecoveryData } from "@/app/shared/components/dataProviders/RecoveryDataProvider";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";

import { appColors } from "@/app/shared/theme/app_colors";
import {
  CARD,
  SURFACE_CARD_STYLE,
  SCROLL_X,
  PANEL_SECTION_HEAD,
  CARD_HEAD_INSET,
  CARD_BODY_INSET,
  PANEL_SECTION_TITLE,
  PANEL_SECTION_SUBTITLE,
} from "@/app/shared/ui/tokens";
import SelectField from "@/app/shared/ui/components/SelectField";

const WEEK_OPTIONS = [
  { value: "2", label: "2 týždne" },
  { value: "4", label: "4 týždne" },
  { value: "8", label: "8 týždňov" },
  { value: "12", label: "12 týždňov" },
];

ensureChartJSRegistered();

export default function DetailSleepStart() {
  const { rows: all } = useRecoveryData();
  const [weeks, setWeeks] = useState<number>(2);
  const [loading, setLoading] = useState<boolean>(false);

  const DAY_PX_PER_LABEL = THEME.chart?.pxPerLabel ?? 26;

  const COLOR = {
    main: appColors.chartLine1,
    bandFill: appColors.chartBandFill,
    missing: appColors.stateBad,
  };

  useEffect(() => setLoading(true), [weeks]);

  const days = weeks * 7;

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

  const labelsISO = useMemo(
    () => dateSeq(startISO, endISO),
    [startISO, endISO]
  );

  const startMin = useMemo(
    () =>
      labelsISO.map((d) => {
        const rec = byDate.get(d);
        const m = rec?.sleep_start_time
          ? HHMMToMinutes(rec.sleep_start_time)
          : null;
        return typeof m === "number" ? m : NaN;
      }),
    [labelsISO, byDate]
  );

  const lowerBand = useMemo(() => labelsISO.map(() => 22 * 60), [labelsISO]); // 22:00
  const upperBand = useMemo(() => labelsISO.map(() => 23 * 60), [labelsISO]); // 23:00

  const comments = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of labelsISO) {
      const c = byDate.get(d)?.comments;
      if (c) m.set(d, c);
    }
    return m;
  }, [labelsISO, byDate]);

  const missingIdx = useMemo(
    () => startMin.map((v) => !Number.isFinite(v)),
    [startMin]
  );

  const missingY = useMemo(() => {
    const n = startMin.length;
    const out = new Array<number | null>(n).fill(null);

    const nextKnown: number[] = new Array(n).fill(-1);
    let last = -1;
    for (let i = n - 1; i >= 0; i--) {
      if (Number.isFinite(startMin[i])) last = i;
      nextKnown[i] = last;
    }

    let prev = -1;
    for (let i = 0; i < n; i++) {
      if (Number.isFinite(startMin[i])) {
        prev = i;
        continue;
      }
      const nxt = nextKnown[i];
      let y: number | null = null;
      if (prev !== -1 && nxt !== -1) {
        const vp = startMin[prev] as number;
        const vn = startMin[nxt] as number;
        const t = (i - prev) / (nxt - prev);
        y = vp + (vn - vp) * t;
      } else if (prev !== -1) y = startMin[prev] as number;
      else if (nxt !== -1) y = startMin[nxt] as number;
      out[i] = y;
    }
    return out;
  }, [startMin]);

  const data: ChartData<"line", number[], string> = useMemo(
    () => ({
      labels: labelsISO,
      datasets: [
        {
          type: "line" as const,
          label: "22:00–23:00 (spodná)",
          data: lowerBand,
          borderColor: "rgba(0,0,0,0)",
          backgroundColor: COLOR.bandFill,
          pointRadius: 0,
          borderWidth: 0,
          tension: 0.2,
          order: 1,
        },
        {
          type: "line" as const,
          label: "22:00–23:00 (horná)",
          data: upperBand,
          borderColor: "rgba(0,0,0,0)",
          backgroundColor: COLOR.bandFill,
          pointRadius: 0,
          borderWidth: 0,
          tension: 0.2,
          fill: "-1" as const,
          order: 1,
        },
        {
          type: "line" as const,
          label: "Sleep start",
          data: startMin,
          borderColor: COLOR.main,
          backgroundColor: COLOR.main,
          pointRadius: 3,
          borderWidth: 2,
          tension: 0,
          spanGaps: true,
          order: 2,
        },
        {
          type: "line" as const,
          label: "Missing",
          data: missingY.map((y, i) =>
            missingIdx[i] && typeof y === "number" ? y : NaN
          ),
          showLine: false,
          pointRadius: 0,
          pointHitRadius: 12,
          pointBackgroundColor: COLOR.missing,
          pointBorderColor: COLOR.missing,
          pointBorderWidth: 2,
          borderWidth: 0,
          order: 999,
          clip: false as any,
        },
      ],
    }),
    [
      labelsISO,
      lowerBand,
      upperBand,
      startMin,
      missingY,
      missingIdx,
      COLOR.bandFill,
      COLOR.main,
      COLOR.missing,
    ]
  );

  const drawMissingOnTop: Plugin<"line"> = useMemo(
    () => ({
      id: "draw-missing-on-top-sleepstart",
      afterDatasetsDraw(chart) {
        const dsIndex = chart.data.datasets.findIndex(
          (d) => d.label === "Missing"
        );
        if (dsIndex < 0) return;
        const meta = chart.getDatasetMeta(dsIndex);
        const ctx = chart.ctx;
        ctx.save();
        ctx.fillStyle = COLOR.missing;
        ctx.strokeStyle = COLOR.missing;
        ctx.lineWidth = 2;
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

  const options: ChartOptions<"line"> = useMemo(
    () =>
      buildRecoveryLineOptions({
        labelsISO,
        yTitle: "čas",
        yTickFormatter: (v: number) => minutesToHHMM(v),
        tooltipTitleForIndex: (i) =>
          new Date((labelsISO[i] ?? "") + "T00:00:00").toLocaleDateString(
            THEME.i18n?.dateLocale ?? "sk-SK"
          ),
        tooltipLabelForItem: (ctx): string | string[] => {
          const idx = ctx.dataIndex ?? 0;
          const label = ctx.dataset?.label ?? "";
          if (label === "Sleep start") {
            const v = startMin[idx];
            const out: string[] = [];
            if (Number.isFinite(v))
              out.push(`Zaspal: ${minutesToHHMM(v as number)}`);
            const c = comments.get(labelsISO[idx] ?? "");
            if (c) out.push(...wrapToLines(c, 44));
            return out.length ? out : "Zaspal: –";
          }
          if (label === "Missing") return "Bez záznamu";
          return "";
        },
        tooltipFilter: (item) => {
          const l = item.dataset.label ?? "";
          return l === "Sleep start" || l === "Missing";
        },
      }),
    [labelsISO, startMin, comments]
  );

  useEffect(() => {
    const t = requestAnimationFrame(() => setLoading(false));
    return () => cancelAnimationFrame(t);
  }, [labelsISO.join("|")]);

  const minWidth = Math.max(
    360,
    Math.round(labelsISO.length * DAY_PX_PER_LABEL)
  );

  return (
    <section className={CARD + " relative"} style={SURFACE_CARD_STYLE}>
      <div className={`${PANEL_SECTION_HEAD} ${CARD_HEAD_INSET}`}>
        <div className="min-w-0">
          <div
            className={PANEL_SECTION_TITLE}
            style={{ color: appColors.textPrimary }}
          >
            Sleep start
          </div>
          <div
            className={PANEL_SECTION_SUBTITLE}
            style={{ color: appColors.textMuted }}
          >
            Čas zaspania + odporúčané pásmo 22:00–23:00.
          </div>
        </div>

        <SelectField
          value={String(weeks)}
          onChange={(e) => setWeeks(Number(e.target.value))}
          options={WEEK_OPTIONS}
          variant="readonly"
          containerClassName="w-[152px]"
        />
      </div>

      <div className={CARD_BODY_INSET}>
        <div
          className={`${SCROLL_X} min-w-0`}
          style={{ WebkitOverflowScrolling: "touch", contain: "inline-size" }}
        >
          <div
            className="relative"
            style={{ height: THEME.chart.weeklyHeight }}
          >
            {loading && (
              <div className="absolute inset-0 grid place-items-center z-10 bg-black/10">
                <LoadingSpinner size="trend" />
              </div>
            )}
            <div style={{ minWidth, height: "100%", maxWidth: "none" }}>
              <Line
                data={data}
                options={options}
                plugins={[drawMissingOnTop]}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
