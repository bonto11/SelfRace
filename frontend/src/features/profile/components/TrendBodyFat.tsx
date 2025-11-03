"use client";

import * as React from "react";
import { Line } from "react-chartjs-2";
import type { ChartData, ChartOptions } from "chart.js";
import { ensureChartJSRegistered } from "@/shared/charts/register";
import { API_URL } from "@/shared/config";
import { useUserId } from "@/shared/hooks/useUserId";
import { getBodyFatBands } from "@/shared/utils/bands";
import { THEME } from "@/shared/theme/tokens";
import LoadingSpinner from "@/shared/components/ui/LoadingSpinner";
import { CARD } from "@/shared/ui/classes";

ensureChartJSRegistered();

type StaticProfile = { sex: "M" | "F" } | null;
type RowBE = { measured_at: string; value_num: number | null };

const DAY = 24 * 3600 * 1000;

function hexA(hex: string, a: number) {
  const h = (hex || "#FFFFFF").replace("#", "");
  const aa = Math.round(Math.min(Math.max(a, 0), 1) * 255)
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();
  return `#${h}${aa}`;
}

function colorForBandLabel(labelRaw: string) {
  const l = (labelRaw || "").toLowerCase();
  if (l.includes("athlete")) return THEME.chart.athletes;
  if (l.includes("fitness")) return THEME.chart.fitness;
  if (l.includes("average")) return THEME.chart.average;
  if (l.includes("essential")) return THEME.chart.essential;
  if (l.includes("obese")) return THEME.chart.obese;
  return THEME.chart.neutral;
}

export default function TrendBodyFat() {
  const { userId } = useUserId();
  const [loading, setLoading] = React.useState(false);
  const [stat, setStat] = React.useState<StaticProfile>(null);
  const [hist, setHist] = React.useState<RowBE[]>([]);
  const [weeks, setWeeks] = React.useState<4 | 8 | 12>(12);

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
        if (alive && s?.success) setStat(s.data as StaticProfile);

        const m = await fetch(
          `${API_URL}/profile/metrics/history/${userId}?metric=body_fat_pct`,
          { cache: "no-store" }
        )
          .then((r) => r.json())
          .catch(() => null);
        const rows: RowBE[] =
          m?.success && Array.isArray(m?.data) ? m.data : [];
        if (alive) setHist(rows);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [userId]);

  // --- transformácia dát + single-point "plná čiara" ---
  const lookbackDays = weeks * 7;
  const samples = hist
    .map((r) => ({
      dISO: (r.measured_at || "").slice(0, 10),
      v: typeof r.value_num === "number" ? r.value_num : NaN,
    }))
    .filter((x) => !!x.dISO);

  let series: { dISO: string; v: number }[] = [];
  if (samples.length === 0) {
    return <div className={`${CARD} p-4`}>Žiadne dáta Body Fat %.</div>;
  } else if (samples.length === 1) {
    // Vygeneruj celé okno lookbacku skončené v deň merania – konštantná hodnota
    const last = new Date(samples[0].dISO);
    const first = new Date(last.getTime() - (lookbackDays - 1) * DAY);
    const labelsIso: string[] = Array.from({ length: lookbackDays }, (_, i) => {
      const d = new Date(first.getTime() + i * DAY);
      return d.toISOString().slice(0, 10);
    });
    series = labelsIso.map((d) => ({ dISO: d, v: samples[0].v }));
  } else {
    const windowed = samples.slice(-lookbackDays);
    series = windowed;
  }

  const labels = series.map((x) =>
    new Date(x.dISO).toLocaleDateString("sk-SK")
  );
  const values = series.map((x) => (Number.isFinite(x.v) ? Number(x.v) : NaN));
  const seriesMax = Math.max(
    0,
    ...(values.filter(Number.isFinite) as number[])
  );
  const finiteVals = values.filter((v) => Number.isFinite(v)) as number[];
  const finiteCnt = finiteVals.length;
  const singleVal = finiteCnt === 1 ? finiteVals[0] : null;

  const bands = stat ? getBodyFatBands(stat.sex) : [];
  // === DATASETS ===
  const datasets: ChartData<"line", number[], string>["datasets"] = [
    // pásma (pozadia)
    ...bands.map((b, i) => {
      const color = colorForBandLabel(b.label || "");
      const yMax =
        typeof b.max === "number"
          ? b.max
          : Math.max(35, Math.ceil(seriesMax + 1));
      return {
        type: "line" as const,
        label: b.label,
        data: labels.map(() => yMax),
        borderColor: hexA(color, 0),
        backgroundColor: hexA(color, 0.18),
        pointRadius: 0,
        borderWidth: 0,
        fill: i === 0 ? "origin" : "-1",
        order: 1,
      };
    }),

    // (A) ak je LEN 1 meranie → najskôr vodorovná „guide“ čiara BEZ bodov
    ...(finiteCnt === 1
      ? [
          {
            type: "line" as const,
            label: "Body Fat % (level)",
            data: labels.map(() => singleVal as number),
            borderColor: THEME.chart.linePrimary, // jasná línia
            backgroundColor: THEME.chart.linePrimary,
            pointRadius: 0, // žiadne bodky
            borderWidth: 2,
            tension: 0,
            spanGaps: true,
            order: 2,
          },
        ]
      : []),

    // (B) reálne merania (1 bod alebo viac). Keď je len 1 bod, nech sa zobrazuje iba on.
    {
      type: "line" as const,
      label: "Body Fat %",
      data: values,
      borderColor: THEME.chart.linePrimary,
      backgroundColor: THEME.chart.linePrimary,
      pointRadius: 2,
      borderWidth: finiteCnt === 1 ? 0 : 2, // pri 1 bode netreba spájať čiarou
      showLine: finiteCnt > 1, // čiara len pri 2+
      tension: 0.25,
      spanGaps: true,
      order: 3,
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
      callbacks: {
        labelColor: (ctx) => {
          const lbl = (ctx.dataset?.label || "").toLowerCase();
          // pásma
          if (lbl.includes("essential")) return { borderColor: THEME.chart.essential, backgroundColor: THEME.chart.essential };
          if (lbl.includes("athlete"))   return { borderColor: THEME.chart.athletes,  backgroundColor: THEME.chart.athletes  };
          if (lbl.includes("fitness"))   return { borderColor: THEME.chart.fitness,   backgroundColor: THEME.chart.fitness   };
          if (lbl.includes("average"))   return { borderColor: THEME.chart.average,   backgroundColor: THEME.chart.average   };
          if (lbl.includes("obese"))     return { borderColor: THEME.chart.obese,     backgroundColor: THEME.chart.obese     };
          // línia hodnoty
          if (lbl.startsWith("body fat")) return { borderColor: THEME.chart.linePrimary, backgroundColor: THEME.chart.linePrimary };
          if (lbl.includes("(level)"))    return { borderColor: THEME.chart.linePrimary, backgroundColor: THEME.chart.linePrimary };
          // fallback
          return { borderColor: THEME.chart.neutral, backgroundColor: THEME.chart.neutral };
        },
        labelTextColor: () => "#FFFFFF",
      },
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

  return (
    <div className={CARD}>
      <div className="flex items-center justify-between p-3 border-b border-neutral-800">
        <h2 className="text-base md:text-lg font-semibold">
          Detail – Body Fat %
        </h2>
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
