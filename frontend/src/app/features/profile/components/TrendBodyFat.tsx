// src/features/profile/components/TrendBodyFat.tsx
"use client";

import * as React from "react";
import { Line } from "react-chartjs-2";
import type { ChartData, ChartOptions } from "chart.js";

import { ensureChartJSRegistered } from "@/app/shared/charts/register";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { getBodyFatBands } from "@/app/shared/utils/bands";
import { OPTIONS } from "@/app/shared/charts/optionsProfile";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
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

export default function TrendBodyFat() {
  const { userId } = useUserId() as { userId: number | null };

  const [loading, setLoading] = React.useState(false);
  const [stat, setStat] = React.useState<StaticProfile | null>(null);
  const [hist, setHist] = React.useState<MetricHistoryRow[]>([]);
  const [weeks, setWeeks] = React.useState<4 | 8 | 12>(12);

  const _height = OPTIONS.Height;
  const _pxPerLabel = OPTIONS.pxPerLabel;

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
        if (!alive) return;
        if (s) setStat(s);
        setHist(m ?? []);
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
    // keep anything >= cutoff (and we keep historical anyway via data points)
    .filter((x) => x.dISO >= cutoffISO || true);

  if (samples.length === 0) {
    return (
      <section className={SURFACE_CARD}>
        <div className={[PANEL_PAD, "text-sm"].join(" ")}>
          Žiadne dáta Body Fat %.
        </div>
      </section>
    );
  }

  let points: { dISO: string; v: number }[] = [...samples];
  if (samples.length === 1) {
    const todayISO = new Date().toISOString().slice(0, 10);
    if (todayISO !== samples[0].dISO) {
      points = [samples[0], { dISO: todayISO, v: samples[0].v }];
    }
  }

  const labelsISO = points.map((p) => p.dISO);
  const labels = labelsISO.map((d) => new Date(d).toLocaleDateString("sk-SK"));
  const values = points.map((p) => p.v);
  const seriesMax = Math.max(
    0,
    ...((values.filter(Number.isFinite) as number[]) || [0]),
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
        fill: i === 0 ? ("origin" as const) : ("-1" as const),
        order: 1,
      };
    }),
    {
      type: "line" as const,
      label: "Body Fat %",
      data: values,
      borderColor: appColors.chartLine1,
      backgroundColor: appColors.chartLine1,
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

  const options: ChartOptions<"line"> = buildRecoveryLineOptions({
    labelsISO,
    yTitle: "%",
    tooltipTitleForIndex: (i) =>
      new Date((labelsISO[i] ?? "") + "T00:00:00").toLocaleDateString("sk-SK"),
    tooltipLabelForItem: (ctx) => {
      const idx = ctx.dataIndex ?? 0;
      const label = ctx.dataset?.label ?? "";
      if (label === "Body Fat %") {
        const v = values[idx];
        return Number.isFinite(v) ? `Body Fat: ${Number(v).toFixed(1)}%` : "—";
      }
      // pásma len ako kontext (nech to nie je spam)
      return "";
    },
    tooltipFilter: (item) => (item.dataset?.label ?? "") === "Body Fat %",
    // špecifiká osi
    yMin: 0,
    yMax: suggestedTop,
  });

  const minWidth = Math.max(360, Math.round(labels.length * _pxPerLabel));

  return (
    <section className={SURFACE_CARD}>
      <div className={[PANEL_PAD, PANEL_INNER_STACK].join(" ")}>
        <div className={PANEL_CARD_HEAD}>
          <h2 className={PANEL_CARD_TITLE}>Detail – Body Fat %</h2>
          <div className={PANEL_ACTIONS_INLINE}>
            <select
              value={weeks}
              onChange={(e) => setWeeks(Number(e.target.value) as 4 | 8 | 12)}
              className={[inputClass, "h-8 text-xs w-[132px]"].join(" ")}
              aria-label="Lookback"
            >
              <option value={4}>4 týždne</option>
              <option value={8}>8 týždňov</option>
              <option value={12}>12 týždňov</option>
            </select>
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
