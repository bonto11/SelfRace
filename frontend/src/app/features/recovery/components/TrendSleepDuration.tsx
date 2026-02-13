"use client";

import { useEffect, useMemo, useState } from "react";
import { Line } from "react-chartjs-2";
import type { ChartData, ChartOptions, Plugin } from "chart.js";

import { ensureChartJSRegistered } from "@/app/shared/charts/register";
import { OPTIONS, WEEK_OPTIONS } from "@/app/shared/charts/optionsRecovery";
import { wrapToLines } from "@/app/shared/utils/recovery";
import { minutesToHHMM } from "@/app/shared/utils/time";
import { buildRecoveryLineOptions } from "@/app/shared/charts/optionsRecovery";
import { useRecoveryData } from "@/app/shared/components/dataProviders/RecoveryDataProvider";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import SelectField from "@/app/shared/ui/components/SelectField";

import { appColors } from "@/app/shared/ui/theme/app_colors";
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
import { useT } from "@/app/shared/i18n/useT"; // Import hooku

ensureChartJSRegistered();

function iso(d: Date) {
  const z = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  return z.toISOString().slice(0, 10);
}
function dateSeq(startISO: string, endISO: string): string[] {
  const out: string[] = [];
  const start = new Date(startISO + "T00:00:00");
  const end = new Date(endISO + "T00:00:00");
  for (let d = start; d <= end; d.setUTCDate(d.getUTCDate() + 1))
    out.push(iso(d));
  return out;
}

function sanitizeSleepDurationMin(v: unknown): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return NaN;
  if (v < 0) return NaN;
  if (v > 18 * 60) return NaN;
  return v;
}

export default function DetailSleepDuration() {
  const t = useT(); // Inicializácia t
  const { rows: all } = useRecoveryData();
  const [weeks, setWeeks] = useState<number>(2);
  const [loading, setLoading] = useState<boolean>(false);

  const _pxPerLabel = OPTIONS.pxPerLabel;
  const _height = OPTIONS.Height;

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
    [startISO, endISO],
  );

  const sleepMin = useMemo(
    () =>
      labelsISO.map((d) => {
        const rec = byDate.get(d);
        return sanitizeSleepDurationMin(rec?.sleep_duration_min);
      }),
    [labelsISO, byDate],
  );

  const lowerBand = useMemo(() => labelsISO.map(() => 420), [labelsISO]);
  const upperBand = useMemo(() => labelsISO.map(() => 540), [labelsISO]);

  const comments = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of labelsISO) {
      const c = byDate.get(d)?.comments;
      if (c) m.set(d, c);
    }
    return m;
  }, [labelsISO, byDate]);

  const missingIdx = useMemo(
    () => sleepMin.map((v) => !Number.isFinite(v)),
    [sleepMin],
  );

  const missingY = useMemo(() => {
    const n = sleepMin.length;
    const out = new Array<number | null>(n).fill(null);

    const nextKnown: number[] = new Array(n).fill(-1);
    let last = -1;
    for (let i = n - 1; i >= 0; i--) {
      if (Number.isFinite(sleepMin[i])) last = i;
      nextKnown[i] = last;
    }

    let prev = -1;
    for (let i = 0; i < n; i++) {
      if (Number.isFinite(sleepMin[i])) {
        prev = i;
        continue;
      }
      const nxt = nextKnown[i];
      let y: number | null = null;
      if (prev !== -1 && nxt !== -1) {
        const vp = sleepMin[prev] as number;
        const vn = sleepMin[nxt] as number;
        const t = (i - prev) / (nxt - prev);
        y = vp + (vn - vp) * t;
      } else if (prev !== -1) y = sleepMin[prev] as number;
      else if (nxt !== -1) y = sleepMin[nxt] as number;
      out[i] = y;
    }
    return out;
  }, [sleepMin]);

  const data: ChartData<"line", number[], string> = useMemo(
    () => ({
      labels: labelsISO,
      datasets: [
        {
          type: "line" as const,
          label: t("recovery.trends.sleepDuration.bandLower"),
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
          label: t("recovery.trends.sleepDuration.bandUpper"),
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
          label: t("recovery.trends.sleepDuration.label"),
          data: sleepMin,
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
          label: t("recovery.trends.common.missingLabel"),
          data: missingY.map((y, i) =>
            missingIdx[i] && typeof y === "number" ? y : NaN,
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
      sleepMin,
      missingY,
      missingIdx,
      COLOR.bandFill,
      COLOR.main,
      COLOR.missing,
      t
    ],
  );

  const drawMissingOnTop: Plugin<"line"> = useMemo(
    () => ({
      id: "draw-missing-on-top-sleepduration",
      afterDatasetsDraw(chart) {
        const dsIndex = chart.data.datasets.findIndex(
          (d) => d.label === t("recovery.trends.common.missingLabel"),
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
    [COLOR.missing, t],
  );

  const options: ChartOptions<"line"> = useMemo(
    () =>
      buildRecoveryLineOptions({
        labelsISO,
        yTitle: t("common.units.min"),
        yTickFormatter: (v: number) => minutesToHHMM(v),
        tooltipTitleForIndex: (i) =>
          new Date((labelsISO[i] ?? "") + "T00:00:00").toLocaleDateString(
            "sk-SK",
          ),
        tooltipLabelForItem: (ctx): string | string[] => {
          const idx = ctx.dataIndex ?? 0;
          const label = ctx.dataset?.label ?? "";
          if (label === t("recovery.trends.sleepDuration.label")) {
            const v = sleepMin[idx];
            const out: string[] = [];
            if (Number.isFinite(v))
              out.push(`${t("recovery.trends.sleepDuration.tooltipLabel")}: ${minutesToHHMM(v as number)}`);
            const c = comments.get(labelsISO[idx] ?? "");
            if (c) out.push(...wrapToLines(c, 44));
            return out.length ? out : `${t("recovery.trends.sleepDuration.tooltipLabel")}: –`;
          }
          if (label === t("recovery.trends.common.missingLabel")) return t("recovery.trends.common.noRecord");
          return "";
        },
        tooltipFilter: (item) => {
          const l = item.dataset.label ?? "";
          return l === t("recovery.trends.sleepDuration.label") || l === t("recovery.trends.common.missingLabel");
        },
      }),
    [labelsISO, sleepMin, comments, t],
  );

  useEffect(() => {
    const tt = requestAnimationFrame(() => setLoading(false));
    return () => cancelAnimationFrame(tt);
  }, [labelsISO.join("|")]);

  const minWidth = Math.max(360, Math.round(labelsISO.length * _pxPerLabel));

  return (
    <section className={CARD + " relative"} style={SURFACE_CARD_STYLE}>
      <div className={`${PANEL_SECTION_HEAD} ${CARD_HEAD_INSET}`}>
        <div className="min-w-0">
          <div
            className={PANEL_SECTION_TITLE}
            style={{ color: appColors.textPrimary }}
          >
            {t("recovery.trends.sleepDuration.title")}
          </div>
          <div
            className={PANEL_SECTION_SUBTITLE}
            style={{ color: appColors.textMuted }}
          >
            {t("recovery.trends.sleepDuration.subtitle")}
          </div>
        </div>

        <SelectField
          value={String(weeks)}
          onChange={(e) => setWeeks(Number(e.target.value))}
          options={WEEK_OPTIONS}
          variant="editable"
          containerClassName="w-[152px]"
        />
      </div>

      <div className={CARD_BODY_INSET}>
        <div
          className={`${SCROLL_X} min-w-0`}
          style={{ WebkitOverflowScrolling: "touch", contain: "inline-size" }}
        >
          <div className="relative" style={{ height: _height }}>
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