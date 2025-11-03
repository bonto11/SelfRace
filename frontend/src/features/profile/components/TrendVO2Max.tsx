"use client";

import { useEffect, useMemo, useState } from "react";
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

type HistoryRow = { VO2Max: number | null; updated_at: string };
type Range = { label: string; min: number | null; max: number | null; color?: string };
type Group = { sex: "M" | "F"; age_min: number; age_max: number; ranges: Range[] };

// #RRGGBB -> #RRGGBBAA
function hexA(hex: string, a: number) {
  const h = hex.replace("#", "");
  const aa = Math.round(Math.min(Math.max(a, 0), 1) * 255)
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();
  return `#${h}${aa}`;
}

function levelColor(label: string) {
  const l = label.toLowerCase();
  if (l.includes("excellent") || l.includes("elite")) return THEME.chart.excellent;
  if (l.includes("superior")) return THEME.chart.superior;
  if (l.includes("good"))     return THEME.chart.good;
  if (l.includes("fair") || l.includes("average")) return THEME.chart.fair;
  if (l.includes("poor"))     return THEME.chart.poor;
  return THEME.chart.neutral;
}

export default function TrendVO2Max() {
  const { userId } = useUserId();
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [sex, setSex] = useState<"M" | "F">("M");
  const [birthDate, setBirthDate] = useState<string>("");
  const [weeks, setWeeks] = useState<4 | 8 | 12>(8);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/profile/vo2-history/${userId}`, { cache: "no-store" });
        const js = await res.json().catch(() => ({}));
        if (!alive) return;
        if (js?.success) {
          setHistory(Array.isArray(js.history) ? js.history : []);
          setSex(js.sex === "F" ? "F" : "M");
          setBirthDate(js.birth_date || "");
        } else {
          setHistory([]);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [userId]);

  // orež na posledných N dní
  const days = weeks * 7;
  const rows = useMemo(() => (days > 0 ? history.slice(-days) : history), [history, days]);
  if (!rows.length) return <div className={`${CARD} p-4`}>Načítavam VO₂Max…</div>;

  // vek + pásma
  const age = Math.floor((Date.now() - (birthDate ? new Date(birthDate).getTime() : Date.now())) / (365.25 * 86400 * 1000));
  const group = (vo2Ref as Group[]).find(g => g.sex === sex && age >= g.age_min && age <= g.age_max);
  const ranges = (group?.ranges ?? []).map(r => ({ ...r, color: levelColor(r.label) }));

  // posledná hodnota → zvýraznenie v legende
  const latestVO2 = rows.at(-1)?.VO2Max ?? null;
  let currentLabel: string | null = null;
  if (latestVO2 != null && ranges.length) {
    for (const r of ranges) {
      if ((r.min == null || latestVO2 >= r.min) && (r.max == null || latestVO2 <= r.max)) {
        currentLabel = r.label.trim();
        break;
      }
    }
  }

  // dáta
  const labels = rows.map(h => new Date(h.updated_at).toLocaleDateString("sk-SK"));
  const series = rows.map(h => (typeof h.VO2Max === "number" ? h.VO2Max : NaN));
  const seriesMax = Math.max(0, ...series.filter(n => Number.isFinite(n)) as number[]);

  // ⚙️ horný limit pásiem/grafu – max(r.max) alebo fallback 105 (tvoj strop)
  const bandMax = Math.max(0, ...ranges.map(r => (typeof r.max === "number" ? r.max : 0)));
  const topMax  = Math.max(105, bandMax, Math.ceil(seriesMax + 1));

  const data: ChartData<"line", number[], string> = {
    labels,
    datasets: [
      // pásma ako vyplnené pozadie
      ...ranges.map((r, i) => ({
        type: "line" as const,
        label: r.label,
        data: labels.map(() => (typeof r.max === "number" ? r.max : topMax)),
        borderColor: hexA(r.color!, 0),
        backgroundColor: hexA(r.color!, 0.18),
        pointRadius: 0,
        borderWidth: 0,
        fill: i === 0 ? "origin" : "-1",
        order: 1,
      })),
      // línia VO₂
      {
        label: "VO₂Max",
        data: series,
        borderColor: THEME.chart.linePrimary,
        backgroundColor: THEME.chart.linePrimary,
        tension: 0.25,
        pointRadius: 2,
        borderWidth: 2,
        order: 2,
      },
    ],
  };

  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: {
        position: THEME.chart.legendPosition,
        labels: { usePointStyle: true, pointStyle: "circle", boxWidth: 6, boxHeight: 6, padding: 8 },
      },
      tooltip: { enabled: true },
    },
    scales: {
      y: {
        beginAtZero: true,
        suggestedMax: topMax,
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