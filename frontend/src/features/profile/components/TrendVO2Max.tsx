// src/features/profile/components/TrendVO2Max.tsx
"use client";

import * as React from "react";
import { Line } from "react-chartjs-2";
import type { ChartData, ChartOptions } from "chart.js";

import { ensureChartJSRegistered } from "@/shared/charts/register";
import { useUserId } from "@/shared/hooks/useUserId";
import vo2Ref from "@/data/VO2Max_Ref_RunnersWorld.json";
import { THEME } from "@/shared/theme/tokens";
import LoadingSpinner from "@/shared/components/ui/LoadingSpinner";
import { CARD, SCROLL_X } from "@/shared/ui/classes";
import { inputClass } from "@/shared/ui";

import type { StaticProfile, MetricHistoryRow, Group } from "@/features/profile/types/profile";
import { apiGetStaticProfile } from "@/features/profile/api/static";
import { apiGetMetricHistory } from "@/features/profile/api/metrics";
import {
  colorForVo2RangeLabel,
  hexWithAlpha,
} from "@/features/profile/utils/profile";

ensureChartJSRegistered();



const DAY = 24 * 3600 * 1000;
const DAY_PX_PER_LABEL = THEME.chart?.pxPerLabel ?? 26;

export default function TrendVO2Max() {
  const { userId, userUid } = useUserId() as {
    userId: number | null;
    userUid?: string | null;
  };

  const [loading, setLoading] = React.useState(false);
  const [weeks, setWeeks] = React.useState<4 | 8 | 12>(8);
  const [stat, setStat] = React.useState<StaticProfile | null>(null);
  const [estHist, setEstHist] = React.useState<MetricHistoryRow[]>([]);
  const [measHist, setMeasHist] = React.useState<MetricHistoryRow[]>([]);

  React.useEffect(() => {
    if (!userId) return;
    let alive = true;

    (async () => {
      setLoading(true);
      try {
        const [s, est, meas] = await Promise.all([
          apiGetStaticProfile(userId, userUid),
          apiGetMetricHistory(userId, "VO2Max_estimated", userUid),
          apiGetMetricHistory(userId, "VO2Max_measured", userUid),
        ]);
        if (alive) {
          if (s) setStat(s);
          setEstHist(est ?? []);
          setMeasHist(meas ?? []);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [userId, userUid]);

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
    return <div className={`${CARD} p-4`}>Žiadne dáta VO₂Max.</div>;
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
  const labels = labelsISO.map((d) =>
    new Date(d).toLocaleDateString(THEME.i18n?.dateLocale ?? "sk-SK")
  );
  const seriesEst = labelsISO.map((d) =>
    estMap.has(d) ? Number(estMap.get(d)) : NaN
  );
  const seriesMeas = labelsISO.map((d) =>
    measMap.has(d) ? Number(measMap.get(d)) : NaN
  );

  // pásma podľa pohlavia + veku
  const sex = stat?.sex === "F" ? "F" : "M";
  const birthDate = stat?.birth_date || "";
  const age = birthDate
    ? Math.floor(
        (Date.now() - new Date(birthDate).getTime()) / (365.25 * 86400 * 1000)
      )
    : 0;

  const group = (vo2Ref as Group[]).find(
    (g) => g.sex === sex && age >= g.age_min && age <= g.age_max
  );
  const ranges =
    group?.ranges?.map((r) => ({
      ...r,
      color: colorForVo2RangeLabel(r.label),
    })) ?? [];

  const finiteVals = [...seriesEst, ...seriesMeas].filter(
    Number.isFinite
  ) as number[];
  const rangeMaxes = ranges.map((r) => (typeof r.max === "number" ? r.max : 0));
  const suggestedTop = Math.max(
    60,
    Math.ceil(
      Math.max(0, ...(finiteVals.length ? finiteVals : [0]), ...rangeMaxes) + 1
    )
  );

  const finiteEst = seriesEst.filter(Number.isFinite) as number[];
  const finiteMeas = seriesMeas.filter(Number.isFinite) as number[];
  const oneEst = finiteEst.length === 1 ? finiteEst[0] : null;
  const oneMeas = finiteMeas.length === 1 ? finiteMeas[0] : null;

  const datasets: ChartData<"line", number[], string>["datasets"] = [
    // pásma
    ...ranges.map((r, i) => ({
      type: "line" as const,
      label: r.label,
      data: labels.map(() =>
        typeof r.max === "number" ? r.max : suggestedTop
      ),
      borderColor: hexWithAlpha(r.color, 0),
      backgroundColor: hexWithAlpha(r.color, 0.18),
      pointRadius: 0,
      borderWidth: 0,
      fill: i === 0 ? "origin" : "-1",
      order: 1,
    })),
    // Estimated – single-level / krivka
    ...(oneEst != null
      ? [
          {
            type: "line" as const,
            label: "VO₂Max (estimated) – level",
            data: labels.map(() => oneEst as number),
            borderColor: THEME.chart.linePrimary,
            backgroundColor: THEME.chart.linePrimary,
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
      borderColor: THEME.chart.linePrimary,
      backgroundColor: THEME.chart.linePrimary,
      pointRadius: 2,
      borderWidth: oneEst != null ? 0 : 2,
      showLine: oneEst == null,
      tension: 0.25,
      spanGaps: true,
      order: 3,
    },
    // Measured – single-level / krivka
    ...(oneMeas != null
      ? [
          {
            type: "line" as const,
            label: "VO₂Max (measured) – level",
            data: labels.map(() => oneMeas as number),
            borderColor: THEME.chart.lineSecondary,
            backgroundColor: THEME.chart.lineSecondary,
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
      borderColor: THEME.chart.lineSecondary,
      backgroundColor: THEME.chart.lineSecondary,
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

  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    elements: { point: { radius: 2, hoverRadius: 6 } },
    plugins: {
      legend: {
        position: THEME.chart.legendPosition,
        labels: {
          usePointStyle: true,
          pointStyle: "circle",
          boxWidth: 6,
          boxHeight: 6,
          padding: 8,
        },
      },
      tooltip: {
        enabled: true,
        backgroundColor: "#0B1220F2",
        borderColor: "#FFFFFF66",
        borderWidth: 1,
        titleColor: "#FFFFFF",
        bodyColor: "#FFFFFF",
        padding: 10,
        usePointStyle: true,
        boxPadding: 4,
        displayColors: true,
        caretSize: 6,
        cornerRadius: 8,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        suggestedMax: suggestedTop,
        grid: { color: THEME.chart.grid },
        ticks: { color: THEME.color.text },
        title: { display: true, text: "ml/kg/min" },
      },
      x: { grid: { color: THEME.chart.gridSoft } },
    },
  };

  const minWidth = Math.max(360, Math.round(labels.length * DAY_PX_PER_LABEL));

  return (
    <div className={`${CARD} relative`}>
      {/* HEADER */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold">Detail – VO₂Max</h2>
        <select
          value={weeks}
          onChange={(e) => setWeeks(Number(e.target.value) as 4 | 8 | 12)}
          className={`${inputClass} h-8 text-xs w-[132px]`}
          aria-label="Lookback"
        >
          <option value={4}>4 týždne</option>
          <option value={8}>8 týždňov</option>
          <option value={12}>12 týždňov</option>
        </select>
      </div>

      {/* GRAPH */}
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
