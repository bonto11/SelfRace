"use client";

import * as React from "react";
import { Line } from "react-chartjs-2";
import type { ChartData, ChartOptions } from "chart.js";
import { ensureChartJSRegistered } from "@/shared/charts/register";
import { API_URL } from "@/shared/config";
import { useUserId } from "@/shared/hooks/useUserId";
import vo2Ref from "@/data/VO2Max_Ref_RunnersWorld.json";
import { THEME } from "@/shared/theme/tokens";
import LoadingSpinner from "@/shared/components/ui/LoadingSpinner";
import { CARD } from "@/shared/ui/classes";

ensureChartJSRegistered();

type StaticRow = { sex: "M" | "F"; birth_date?: string | null } | null;
type RowBE = { measured_at: string; value_num: number | null };
type Range = { label: string; min: number | null; max: number | null };
type Group = {
  sex: "M" | "F";
  age_min: number;
  age_max: number;
  ranges: Range[];
};

const DAY = 24 * 3600 * 1000;

function hexA(hex: string, a: number) {
  const h = (hex || "#FFFFFF").replace("#", "");
  const aa = Math.round(Math.min(Math.max(a, 0), 1) * 255)
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();
  return `#${h}${aa}`;
}
function levelColor(label: string) {
  const l = (label || "").toLowerCase();
  if (l.includes("excellent") || l.includes("elite"))
    return THEME.chart.excellent;
  if (l.includes("superior")) return THEME.chart.superior;
  if (l.includes("good")) return THEME.chart.good;
  if (l.includes("fair") || l.includes("average")) return THEME.chart.fair;
  if (l.includes("poor")) return THEME.chart.poor;
  return THEME.chart.neutral;
}

export default function TrendVO2Max() {
  const { userId } = useUserId();

  // stabilná kostra hookov
  const [loading, setLoading] = React.useState(false);
  const [weeks, setWeeks] = React.useState<4 | 8 | 12>(8);
  const [stat, setStat] = React.useState<StaticRow>(null);
  const [estHist, setEstHist] = React.useState<RowBE[]>([]);
  const [measHist, setMeasHist] = React.useState<RowBE[]>([]);

  React.useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const s = await fetch(`${API_URL}/profile/static/${userId}`, {
          cache: "no-store",
        })
          .then((r) => r.json())
          .catch(() => null);
        if (alive && s?.success) setStat(s.data as StaticRow);

        const e = await fetch(
          `${API_URL}/profile/metrics/history/${userId}?metric=VO2Max_estimated`,
          { cache: "no-store" }
        )
          .then((r) => r.json())
          .catch(() => null);
        const eRows: RowBE[] =
          e?.success && Array.isArray(e?.data) ? e.data : [];
        if (alive) setEstHist(eRows);

        const m = await fetch(
          `${API_URL}/profile/metrics/history/${userId}?metric=VO2Max_measured`,
          { cache: "no-store" }
        )
          .then((r) => r.json())
          .catch(() => null);
        const mRows: RowBE[] =
          m?.success && Array.isArray(m?.data) ? m.data : [];
        if (alive) setMeasHist(mRows);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [userId]);

  // --- zjednotená os X + single-point "plná čiara" ---
  const lookbackDays = weeks * 7;

  const estDays = new Set<string>();
  for (const r of estHist)
    if (r?.measured_at) estDays.add(r.measured_at.slice(0, 10));
  const measDays = new Set<string>();
  for (const r of measHist)
    if (r?.measured_at) measDays.add(r.measured_at.slice(0, 10));

  let allDays = Array.from(new Set<string>([...estDays, ...measDays])).sort();

  // ak máme len 1 deň v celom grafe -> vygeneruj celé okno lookbacku (konštantná čiara pre tú metriku, druhá ostane NaN)
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

  // ak bol len jeden estimated bod a vygenerovali sme okno, rozkopíruj hodnotu cez celé okno
  if (estMap.size === 1 && allDays.length > 1) {
    const onlyVal = Array.from(estMap.values())[0];
    estMap.clear();
    for (const d of allDays) estMap.set(d, onlyVal);
  }
  // ak bol len jeden measured bod a vygenerovali sme okno, rozkopíruj hodnotu cez celé okno
  if (measMap.size === 1 && allDays.length > 1) {
    const onlyVal = Array.from(measMap.values())[0];
    measMap.clear();
    for (const d of allDays) measMap.set(d, onlyVal);
  }

  const labels = allDays.map((d) => new Date(d).toLocaleDateString("sk-SK"));
  const seriesEst = allDays.map((d) =>
    estMap.has(d) ? Number(estMap.get(d)) : NaN
  );
  const seriesMeas = allDays.map((d) =>
    measMap.has(d) ? Number(measMap.get(d)) : NaN
  );

  // pásma
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
  const ranges = (group?.ranges ?? []).map((r) => ({
    ...r,
    color: levelColor(r.label),
  }));

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

  const finiteEst = seriesEst.filter((v) => Number.isFinite(v)) as number[];
  const finiteMeas = seriesMeas.filter((v) => Number.isFinite(v)) as number[];
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
      borderColor: hexA(r.color!, 0),
      backgroundColor: hexA(r.color!, 0.18),
      pointRadius: 0,
      borderWidth: 0,
      fill: i === 0 ? "origin" : "-1",
      order: 1,
    })),

    // Estimated – ak je len 1 meranie → vodorovná „guide“ čiara bez bodov
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

    // Estimated – reálne body/krivka
    {
      type: "line" as const,
      label: "VO₂Max (estimated)",
      data: seriesEst,
      borderColor: THEME.chart.linePrimary,
      backgroundColor: THEME.chart.linePrimary,
      pointRadius: 2,
      borderWidth: oneEst != null ? 0 : 2, // ak len 1 bod, nespájaj čiarou
      showLine: oneEst == null, // čiara len pri 2+
      tension: 0.25,
      spanGaps: true,
      order: 3,
    },

    // Measured – ak je len 1 meranie → vodorovná „guide“ čiara bez bodov
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

    // Measured – reálne body/krivka
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
        callbacks: {
          labelColor: (ctx) => {
            const lbl = (ctx.dataset?.label || "").toLowerCase();
            // pásma
            if (lbl.includes("excellent") || lbl.includes("elite"))
              return {
                borderColor: THEME.chart.excellent,
                backgroundColor: THEME.chart.excellent,
              };
            if (lbl.includes("superior"))
              return {
                borderColor: THEME.chart.superior,
                backgroundColor: THEME.chart.superior,
              };
            if (lbl.includes("good"))
              return {
                borderColor: THEME.chart.good,
                backgroundColor: THEME.chart.good,
              };
            if (lbl.includes("fair") || lbl.includes("average"))
              return {
                borderColor: THEME.chart.fair,
                backgroundColor: THEME.chart.fair,
              };
            if (lbl.includes("poor"))
              return {
                borderColor: THEME.chart.poor,
                backgroundColor: THEME.chart.poor,
              };
            // krivky
            if (lbl.includes("estimated"))
              return {
                borderColor: THEME.chart.linePrimary,
                backgroundColor: THEME.chart.linePrimary,
              };
            if (lbl.includes("measured"))
              return {
                borderColor: THEME.chart.lineSecondary,
                backgroundColor: THEME.chart.lineSecondary,
              };
            if (lbl.includes("level"))
              return {
                borderColor: THEME.chart.neutral,
                backgroundColor: THEME.chart.neutral,
              };
            // fallback
            return {
              borderColor: THEME.chart.neutral,
              backgroundColor: THEME.chart.neutral,
            };
          },
          labelTextColor: () => "#FFFFFF",
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        suggestedMax: suggestedTop,
        grid: { color: THEME.chart.grid },
        ticks: { color: THEME.color.text },
      },
      x: { grid: { color: THEME.chart.gridSoft } },
    },
  };

  return (
    <div className={CARD}>
      <div className="flex items-center justify-between p-3 border-b border-neutral-800">
        <h2 className="text-base md:text-lg font-semibold">Detail – VO₂Max</h2>
        <div className="flex items-center gap-2 text-xs">
          <select
            value={weeks}
            onChange={(e) => setWeeks(Number(e.target.value) as 4 | 8 | 12)}
            className="px-2 py-1 rounded bg-gray-700 text-white"
            aria-label="Lookback"
          >
            <option value={4}>4 týždne</option>
            <option value={8}>8 týždňov</option>
            <option value={12}>12 týždňov</option>
          </select>
        </div>
      </div>

      <div className="p-3">
        <div className="relative" style={{ height: THEME.chart.weeklyHeight }}>
          {loading && (
            <div className="absolute inset-0 grid place-items-center z-10 bg-black/10">
              <LoadingSpinner size="trend" />
            </div>
          )}
          <Line data={data} options={options} />
        </div>
      </div>
    </div>
  );
}
