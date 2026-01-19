// src/features/profile/components/TrendBodyFat.tsx
"use client";

import * as React from "react";
import { Line } from "react-chartjs-2";
import type { ChartData, ChartOptions } from "chart.js";

import { ensureChartJSRegistered } from "@/app/shared/charts/register";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { getBodyFatBands } from "@/app/shared/utils/bands";
import { THEME } from "@/app/shared/theme/tokens";
import LoadingSpinner from "@/app/shared/components/ui/LoadingSpinner";
import { CARD, SCROLL_X } from "@/app/shared/theme/uiTokens";
import { inputClass } from "@/app/shared/ui";

import type {
  StaticProfile,
  MetricHistoryRow,
} from "@/app/features/profile/types/profile";
import { apiGetStaticProfile } from "@/app/features/profile/api/static";
import { apiGetMetricHistory } from "@/app/features/profile/api/metrics";
import {
  colorForBodyFatBand,
  hexWithAlpha,
} from "@/app/features/profile/utils/profile";

ensureChartJSRegistered();

const DAY_PX_PER_LABEL = THEME.chart?.pxPerLabel ?? 26;

export default function TrendBodyFat() {
  const { userId } = useUserId() as {
    userId: number | null;
  };

  const [loading, setLoading] = React.useState(false);
  const [stat, setStat] = React.useState<StaticProfile | null>(null);
  const [hist, setHist] = React.useState<MetricHistoryRow[]>([]);
  const [weeks, setWeeks] = React.useState<4 | 8 | 12>(12);

  React.useEffect(() => {
    if (!userId) return;
    let alive = true;

    (async () => {
      setLoading(true);
      try {
        const [s, m] = await Promise.all([
          apiGetStaticProfile(userId),
          apiGetMetricHistory(userId, "body_fat_pct"),
        ]);
        if (alive) {
          if (s) setStat(s);
          setHist(m ?? []);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [userId]);

  const lookbackDays = weeks * 7;
  const cutoffISO = new Date(Date.now() - lookbackDays * 86400000)
    .toISOString()
    .slice(0, 10);

  const samples = (hist || [])
    .map((r) => ({
      dISO: (r.measured_at || "").slice(0, 10),
      v: typeof r.value_num === "number" ? r.value_num : NaN,
    }))
    .filter((x) => !!x.dISO && Number.isFinite(x.v))
    .sort((a, b) => (a.dISO < b.dISO ? -1 : a.dISO > b.dISO ? 1 : 0))
    // nechávame aj staršie + posledné merania
    .filter((x) => x.dISO >= cutoffISO || true);

  if (samples.length === 0) {
    return <div className={`${CARD} p-4`}>Žiadne dáta Body Fat %.</div>;
  }

  // ak je len 1 meranie -> pridáme bod dnes
  let points: { dISO: string; v: number }[] = [...samples];
  if (samples.length === 1) {
    const todayISO = new Date().toISOString().slice(0, 10);
    if (todayISO !== samples[0].dISO) {
      points = [samples[0], { dISO: todayISO, v: samples[0].v }];
    }
  }

  const labelsISO = points.map((p) => p.dISO);
  const labels = labelsISO.map((d) =>
    new Date(d).toLocaleDateString(THEME.i18n?.dateLocale ?? "sk-SK")
  );
  const values = points.map((p) => p.v);
  const seriesMax = Math.max(
    0,
    ...((values.filter(Number.isFinite) as number[]) || [0])
  );

  const bands = stat ? getBodyFatBands(stat.sex ?? null) : [];

  const datasets: ChartData<"line", number[], string>["datasets"] = [
    ...bands.map((b, i) => {
      const color = colorForBodyFatBand(b.label || "");
      const yMax =
        typeof b.max === "number"
          ? b.max
          : Math.max(35, Math.ceil(seriesMax + 1));
      return {
        type: "line" as const,
        label: b.label,
        data: labels.map(() => yMax),
        borderColor: hexWithAlpha(color, 0),
        backgroundColor: hexWithAlpha(color, 0.18),
        pointRadius: 0,
        borderWidth: 0,
        fill: i === 0 ? "origin" : "-1",
        order: 1,
      };
    }),
    {
      type: "line" as const,
      label: "Body Fat %",
      data: values,
      borderColor: THEME.chart.linePrimary,
      backgroundColor: THEME.chart.linePrimary,
      pointRadius: 2,
      borderWidth: 2,
      showLine: true,
      tension: 0,
      spanGaps: true,
      order: 2,
    },
  ];

  const data: ChartData<"line", number[], string> = { labels, datasets };
  const suggestedTop = Math.max(35, Math.ceil(seriesMax + 1));

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
        suggestedMin: 0,
        suggestedMax: suggestedTop,
        grid: { color: THEME.chart.grid },
        ticks: { color: THEME.color.text },
        title: { display: true, text: "%" },
      },
      x: { grid: { color: THEME.chart.gridSoft } },
    },
  };

  const minWidth = Math.max(360, Math.round(labels.length * DAY_PX_PER_LABEL));

  return (
    <div className={`${CARD} relative`}>
      {/* HEADER */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold">Detail – Body Fat %</h2>
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
