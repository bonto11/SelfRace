// src/features/profile/components/TrendVO2Max.tsx
"use client";

import * as React from "react";
import { Line } from "react-chartjs-2";
import type { ChartData, ChartOptions } from "chart.js";

import { ensureChartJSRegistered } from "@/app/shared/charts/register";
import { useUserId } from "@/app/shared/hooks/useUserId";
import vo2Ref from "@/app/data/VO2Max_Ref_RunnersWorld.json";
import { OPTIONS, WEEK_OPTIONS } from "@/app/shared/charts/optionsProfile";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import SelectField from "@/app/shared/ui/components/SelectField";

import type {
  StaticProfile,
  MetricHistoryRow,
  Group,
} from "@/app/features/profile/types/profile";
import { apiGetStaticProfile } from "@/app/features/profile/api/static";
import { apiGetMetricHistory } from "@/app/features/profile/api/metrics";
import {
  colorForVo2RangeLabel,
  hexWithAlpha,
} from "@/app/features/profile/utils/profile";

import { buildRecoveryLineOptions } from "@/app/shared/charts/optionsRecovery";
import {
  SURFACE_CARD,
  SCROLL_X,
  PANEL_PAD,
  PANEL_INNER_STACK,
  PANEL_CARD_HEAD,
  PANEL_CARD_TITLE,
  PANEL_ACTIONS_INLINE,
} from "@/app/shared/ui/tokens";
import { appColors } from "@/app/shared/ui/theme/app_colors";

ensureChartJSRegistered();

export default function TrendVO2Max() {
  const { userId } = useUserId() as { userId: number | null };

  const [loading, setLoading] = React.useState(false);
  const [weeks, setWeeks] = React.useState<number>(4);
  const [stat, setStat] = React.useState<StaticProfile | null>(null);
  const [estHist, setEstHist] = React.useState<MetricHistoryRow[]>([]);
  const [measHist, setMeasHist] = React.useState<MetricHistoryRow[]>([]);

  const _height = OPTIONS.Height;
  const _pxPerLabel = OPTIONS.pxPerLabel;
  const DAY = 24 * 3600 * 1000;

  React.useEffect(() => {
    if (!userId) return;
    let alive = true;

    (async () => {
      setLoading(true);
      try {
        const [s, est, meas] = await Promise.all([
          apiGetStaticProfile(userId),
          apiGetMetricHistory(userId, "VO2Max_estimated"),
          apiGetMetricHistory(userId, "VO2Max_measured"),
        ]);
        if (!alive) return;
        if (s) setStat(s);
        setEstHist(est ?? []);
        setMeasHist(meas ?? []);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [userId]);

  const lookbackDays = weeks * 7;

  const estDays = new Set<string>();
  for (const r of estHist)
    if (r?.measured_at) estDays.add(r.measured_at.slice(0, 10));

  const measDays = new Set<string>();
  for (const r of measHist)
    if (r?.measured_at) measDays.add(r.measured_at.slice(0, 10));

  let allDays = Array.from(new Set<string>([...estDays, ...measDays])).sort();

  if (allDays.length === 1) {
    const last = new Date(allDays[0]);
    const first = new Date(last.getTime() - (lookbackDays - 1) * DAY);
    allDays = Array.from({ length: lookbackDays }, (_, i) => {
      const d = new Date(first.getTime() + i * DAY);
      return d.toISOString().slice(0, 10);
    });
  } else if (allDays.length > lookbackDays) {
    allDays = allDays.slice(-lookbackDays);
  }

  if (!allDays.length) {
    return (
      <section className={SURFACE_CARD}>
        <div className={[PANEL_PAD, "text-sm"].join(" ")}>
          Žiadne dáta VO₂Max.
        </div>
      </section>
    );
  }

  const estMap = new Map<string, number>();
  for (const r of estHist)
    if (typeof r?.value_num === "number" && r?.measured_at)
      estMap.set(r.measured_at.slice(0, 10), r.value_num);

  const measMap = new Map<string, number>();
  for (const r of measHist)
    if (typeof r?.value_num === "number" && r?.measured_at)
      measMap.set(r.measured_at.slice(0, 10), r.value_num);

  if (estMap.size === 1 && allDays.length > 1) {
    const onlyVal = Array.from(estMap.values())[0];
    estMap.clear();
    for (const d of allDays) estMap.set(d, onlyVal);
  }
  if (measMap.size === 1 && allDays.length > 1) {
    const onlyVal = Array.from(measMap.values())[0];
    measMap.clear();
    for (const d of allDays) measMap.set(d, onlyVal);
  }

  const labelsISO = allDays;
  const labels = labelsISO.map((d) => new Date(d).toLocaleDateString("sk-SK"));

  const seriesEst = labelsISO.map((d) =>
    estMap.has(d) ? Number(estMap.get(d)) : NaN,
  );
  const seriesMeas = labelsISO.map((d) =>
    measMap.has(d) ? Number(measMap.get(d)) : NaN,
  );

  const sex = stat?.sex === "F" ? "F" : "M";
  const birthDate = stat?.birth_date || "";
  const age = birthDate
    ? Math.floor(
        (Date.now() - new Date(birthDate).getTime()) / (365.25 * 86400 * 1000),
      )
    : 0;

  const group = (vo2Ref as Group[]).find(
    (g) => g.sex === sex && age >= g.age_min && age <= g.age_max,
  );

  const ranges =
    group?.ranges?.map((r) => ({
      ...r,
      color: colorForVo2RangeLabel(r.label),
    })) ?? [];

  const finiteVals = [...seriesEst, ...seriesMeas].filter(
    Number.isFinite,
  ) as number[];
  const rangeMaxes = ranges.map((r) => (typeof r.max === "number" ? r.max : 0));

  const suggestedTop = Math.max(
    60,
    Math.ceil(
      Math.max(0, ...(finiteVals.length ? finiteVals : [0]), ...rangeMaxes) + 1,
    ),
  );

  const finiteEst = seriesEst.filter(Number.isFinite) as number[];
  const finiteMeas = seriesMeas.filter(Number.isFinite) as number[];
  const oneEst = finiteEst.length === 1 ? finiteEst[0] : null;
  const oneMeas = finiteMeas.length === 1 ? finiteMeas[0] : null;

  const datasets: ChartData<"line", number[], string>["datasets"] = [
    ...ranges.map((r, i) => ({
      type: "line" as const,
      label: r.label,
      data: labels.map(() =>
        typeof r.max === "number" ? r.max : suggestedTop,
      ),
      borderColor: hexWithAlpha(r.color, 0),
      backgroundColor: hexWithAlpha(r.color, 0.18),
      pointRadius: 0,
      borderWidth: 0,
      fill: i === 0 ? ("origin" as const) : ("-1" as const),
      order: 1,
    })),
    ...(oneEst != null
      ? [
          {
            type: "line" as const,
            label: "VO₂Max (estimated) – level",
            data: labels.map(() => oneEst as number),
            borderColor: appColors.chartLine1,
            backgroundColor: appColors.chartLine1,
            pointRadius: 0,
            borderWidth: 2,
            tension: 0,
            spanGaps: true,
            order: 2,
          },
        ]
      : []),
    {
      type: "line" as const,
      label: "VO₂Max (estimated)",
      data: seriesEst,
      borderColor: appColors.chartLine1,
      backgroundColor: appColors.chartLine1,
      pointRadius: 2,
      borderWidth: oneEst != null ? 0 : 2,
      showLine: oneEst == null,
      tension: 0.25,
      spanGaps: true,
      order: 3,
    },
    ...(oneMeas != null
      ? [
          {
            type: "line" as const,
            label: "VO₂Max (measured) – level",
            data: labels.map(() => oneMeas as number),
            borderColor: appColors.chartLine2,
            backgroundColor: appColors.chartLine2,
            pointRadius: 0,
            borderWidth: 2,
            borderDash: [6, 4],
            tension: 0,
            spanGaps: true,
            order: 3,
          },
        ]
      : []),
    {
      type: "line" as const,
      label: "VO₂Max (measured)",
      data: seriesMeas,
      borderColor: appColors.chartLine2,
      backgroundColor: appColors.chartLine2,
      pointRadius: 2,
      borderDash: [6, 4],
      borderWidth: oneMeas != null ? 0 : 2,
      showLine: oneMeas == null,
      tension: 0.25,
      spanGaps: true,
      order: 4,
    },
  ];

  const data: ChartData<"line", number[], string> = { labels, datasets };

  const options: ChartOptions<"line"> = buildRecoveryLineOptions({
    labelsISO,
    yTitle: "ml/kg/min",
    tooltipTitleForIndex: (i) =>
      new Date((labelsISO[i] ?? "") + "T00:00:00").toLocaleDateString("sk-SK"),
    tooltipLabelForItem: (ctx) => {
      const idx = ctx.dataIndex ?? 0;
      const label = ctx.dataset?.label ?? "";
      if (label === "VO₂Max (estimated)") {
        const v = seriesEst[idx];
        return Number.isFinite(v) ? `Estimated: ${Number(v).toFixed(1)}` : "—";
      }
      if (label === "VO₂Max (measured)") {
        const v = seriesMeas[idx];
        return Number.isFinite(v) ? `Measured: ${Number(v).toFixed(1)}` : "—";
      }
      return "";
    },
    tooltipFilter: (item) => {
      const l = item.dataset?.label ?? "";
      return l === "VO₂Max (estimated)" || l === "VO₂Max (measured)";
    },
    yMin: 0,
    yMax: suggestedTop,
  });

  const minWidth = Math.max(360, Math.round(labels.length * _pxPerLabel));

  return (
    <section className={SURFACE_CARD}>
      <div className={[PANEL_PAD, PANEL_INNER_STACK].join(" ")}>
        <div className={PANEL_CARD_HEAD}>
          <h2 className={PANEL_CARD_TITLE}>Detail – VO₂Max</h2>
          <div className={PANEL_ACTIONS_INLINE}>
            <SelectField
              value={String(weeks)}
              onChange={(e) => setWeeks(Number(e.target.value))}
              options={WEEK_OPTIONS}
              containerClassName="w-[132px]"
              variant="editable"
              placeholder="—"
            />
          </div>
        </div>
      </div>

      <div
        className={[SCROLL_X, "min-w-0"].join(" ")}
        style={{ WebkitOverflowScrolling: "touch", contain: "inline-size" }}
      >
        <div className="relative" style={{ height: _height }}>
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
    </section>
  );
}
