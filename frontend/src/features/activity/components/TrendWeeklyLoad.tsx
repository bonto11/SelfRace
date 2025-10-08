// src/features/activity/components/TrendWeeklyLoad.tsx
// Weekly stacked bar + monotony/strain – koše: run, bike, strength, mixed, skate (+other).

"use client";
import { Chart, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend,  Chart as ChartJS, ChartData, ChartOptions} from 'chart.js';
Chart.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend);

import { useEffect, useMemo, useState } from "react";
import { Chart as MixedChart } from "react-chartjs-2";
import WeeklySummary from "@/features/activity/components/WeeklySummary";
import { API_URL } from "@/shared/config";
import { useUserId } from "@/shared/hooks/useUserId";
import { useLocalStorage } from "@/shared/hooks/useLocalStorage";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

type Metric = "km" | "time" | "trimp";

type WeekRow = {
  week: string;
  label: string;
  start: string;
  end: string;

  km_run: number;
  km_ride: number;
  km_mixed: number;
  km_skate: number;
  km_total: number;

  time_min: number;
  time_run_min: number;
  time_ride_min: number;
  time_strength_min: number;
  time_mixed_min: number;
  time_skate_min: number;
  time_other_min: number;

  trimp_run: number;
  trimp_ride: number;
  trimp_strength: number;
  trimp_mixed: number;
  trimp_skate: number;
  trimp_other: number;
  trimp: number;

  monotony: { km?: number; time?: number; trimp?: number };
  strain: { km?: number; time?: number; trimp?: number };
};


const DEFAULTS = {
  lookback: 26,
  metric: "km" as const,
  sports: { run: true, bike: true, strength: true, mixed: true, skate: true, other: true },
};

const C = {
  run: "#22D3EE",
  bike: "#A78BFA",
  strength: "#F59E0B",
  mixed: "#34D399",
  skate: "#60A5FA",
  other: "#9CA3AF",
  monotony: "#84CC16",
  strain: "#FDE047",
};
const alpha = (hex: string, a: number) =>
  `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(
    hex.slice(3, 5),
    16
  )},${parseInt(hex.slice(5, 7), 16)},${a})`;

const fmtMin = (m: number) => {
  const mm = Math.round(m || 0);
  if (mm < 60) return `${mm} min`;
  const h = Math.floor(mm / 60),
    r = mm % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
};
const fmtKm = (v: number) => `${(v || 0).toFixed(1)} km`;

export type WeekPick = { week: string; start: string; end: string };

export default function TrendWeeklyLoad({
  onPickWeek,
}: {
  onPickWeek?: (w: WeekPick) => void;
}) {
  const { userId } = useUserId();

  const [metric, setMetric]         = useLocalStorage<"km"|"time"|"trimp">("tw_metric", DEFAULTS.metric);
  const [lookback, setLookback]     = useLocalStorage<number>("tw_lookback", DEFAULTS.lookback);

  const [sRun, setSRun]             = useLocalStorage<boolean>("tw_run", DEFAULTS.sports.run);
  const [sBike, setSBike]           = useLocalStorage<boolean>("tw_bike", DEFAULTS.sports.bike);
  const [sStrength, setSStrength]   = useLocalStorage<boolean>("tw_strength", DEFAULTS.sports.strength);
  const [sMixed, setSMixed]         = useLocalStorage<boolean>("tw_mixed", DEFAULTS.sports.mixed);
  const [sSkate, setSSkate]         = useLocalStorage<boolean>("tw_skate", DEFAULTS.sports.skate);
  const [sOther, setSOther]         = useLocalStorage<boolean>("tw_other", DEFAULTS.sports.other);

  const [weeks, setWeeks] = useState<WeekRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [picked, setPicked] = useState<WeekPick | null>(null);

  useEffect(() => { localStorage.setItem("tw_lookback", JSON.stringify(lookback)); }, [lookback]);
  useEffect(() => { localStorage.setItem("tw_metric", JSON.stringify(metric)); }, [metric]);
  useEffect(() => { localStorage.setItem("tw_run", JSON.stringify(sRun)); }, [sRun]);
  useEffect(() => { localStorage.setItem("tw_bike", JSON.stringify(sBike)); }, [sBike]);
  useEffect(() => { localStorage.setItem("tw_strength", JSON.stringify(sStrength)); }, [sStrength]);
  useEffect(() => { localStorage.setItem("tw_mixed", JSON.stringify(sMixed)); }, [sMixed]);
  useEffect(() => { localStorage.setItem("tw_skate", JSON.stringify(sSkate)); }, [sSkate]);
  useEffect(() => { localStorage.setItem("tw_other", JSON.stringify(sOther)); }, [sOther]);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      setLoading(true);
      try {
        const url = `${API_URL}/analytics/weekly/${userId}?weeks=${lookback}`;
        const res = await fetch(url);
        const json = await res.json().catch(() => ({}));

        const raw: any[] = Array.isArray(json?.weeks)
          ? json.weeks
          : Array.isArray(json?.data)
          ? json.data
          : [];
        const num = (v: any) => (Number.isFinite(+v) ? +v : 0);

        const norm: WeekRow[] = raw.map((w) => ({
          week: w.week ?? w.iso_week ?? w.label ?? "",
          label: w.label ?? w.week ?? w.iso_week ?? "",
          start: w.start ?? "",
          end: w.end ?? "",

          km_run: num(w.km_run ?? w.run_km),
          km_ride: num(w.km_ride ?? w.ride_km ?? w.km_bike),
          km_mixed: num(w.km_mixed),
          km_skate: num(w.km_skate),
          km_total: num(w.km_total ?? w.total_km),

          time_min: num(w.time_min ?? w.total_min),
          time_run_min: num(w.time_run_min ?? w.run_min),
          time_ride_min: num(w.time_ride_min ?? w.ride_min),
          time_strength_min: num(
            w.time_strength_min ?? w.strength_min ?? w.gym_min
          ),
          time_mixed_min: num(w.time_mixed_min),
          time_skate_min: num(w.time_skate_min),
          time_other_min: num(w.time_other_min ?? w.other_min),

          trimp_run: num(w.trimp_run ?? w.run_trimp),
          trimp_ride: num(w.trimp_ride ?? w.bike_trimp),
          trimp_strength: num(w.trimp_strength ?? w.strength_trimp),
          trimp_mixed: num(w.trimp_mixed),
          trimp_skate: num(w.trimp_skate),
          trimp_other: num(w.trimp_other ?? w.other_trimp),
          trimp: num(w.trimp ?? w.total_trimp),

          monotony: w.monotony ?? {},
          strain: w.strain ?? {},
        }));

        setWeeks(norm);
      } catch (e) {
        console.error("[FE] weekly error:", e);
        setWeeks([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId, lookback]);

  const labels = useMemo(() => weeks.map((w) => w.label || w.week), [weeks]);
  const monoSeries = useMemo(
    () => weeks.map((w) => w.monotony?.[metric] ?? null),
    [weeks, metric]
  );
  const strainSeries = useMemo(
    () => weeks.map((w) => w.strain?.[metric] ?? null),
    [weeks, metric]
  );

  const monoMax =
    monoSeries.filter((v): v is number => v != null).length > 0
      ? Math.max(1, ...monoSeries.filter((v): v is number => v != null))
      : 3;
  const strainMax =
    strainSeries.filter((v): v is number => v != null).length > 0
      ? Math.max(1, ...strainSeries.filter((v): v is number => v != null))
      : 10;

  const datasets = useMemo(() => {
    const arr: any[] = [];

    if (metric === "km") {
      if (sRun)
        arr.push({
          type: "bar" as const,
          label: "Km (run)",
          data: weeks.map((w) => w.km_run),
          backgroundColor: alpha(C.run, 0.85),
          borderColor: C.run,
          borderWidth: 1,
          yAxisID: "y",
        });
      if (sBike)
        arr.push({
          type: "bar" as const,
          label: "Km (bike)",
          data: weeks.map((w) => w.km_ride),
          backgroundColor: alpha(C.bike, 0.85),
          borderColor: C.bike,
          borderWidth: 1,
          yAxisID: "y",
        });
      if (sMixed)
        arr.push({
          type: "bar" as const,
          label: "Km (mixed)",
          data: weeks.map((w) => w.km_mixed),
          backgroundColor: alpha(C.mixed, 0.85),
          borderColor: C.mixed,
          borderWidth: 1,
          yAxisID: "y",
        });
      if (sSkate)
        arr.push({
          type: "bar" as const,
          label: "Km (skate)",
          data: weeks.map((w) => w.km_skate),
          backgroundColor: alpha(C.skate, 0.85),
          borderColor: C.skate,
          borderWidth: 1,
          yAxisID: "y",
        });
    }

    if (metric === "time") {
      if (sRun)
        arr.push({
          type: "bar" as const,
          label: "Run",
          data: weeks.map((w) => w.time_run_min),
          backgroundColor: alpha(C.run, 0.85),
          borderColor: C.run,
          borderWidth: 1,
          yAxisID: "y",
        });
      if (sBike)
        arr.push({
          type: "bar" as const,
          label: "Bike",
          data: weeks.map((w) => w.time_ride_min),
          backgroundColor: alpha(C.bike, 0.85),
          borderColor: C.bike,
          borderWidth: 1,
          yAxisID: "y",
        });
      if (sStrength)
        arr.push({
          type: "bar" as const,
          label: "Strength",
          data: weeks.map((w) => w.time_strength_min),
          backgroundColor: alpha(C.strength, 0.9),
          borderColor: C.strength,
          borderWidth: 1,
          yAxisID: "y",
        });
      if (sMixed)
        arr.push({
          type: "bar" as const,
          label: "Mixed",
          data: weeks.map((w) => w.time_mixed_min),
          backgroundColor: alpha(C.mixed, 0.9),
          borderColor: C.mixed,
          borderWidth: 1,
          yAxisID: "y",
        });
      if (sSkate)
        arr.push({
          type: "bar" as const,
          label: "Skate",
          data: weeks.map((w) => w.time_skate_min),
          backgroundColor: alpha(C.skate, 0.9),
          borderColor: C.skate,
          borderWidth: 1,
          yAxisID: "y",
        });
      if (sOther)
        arr.push({
          type: "bar" as const,
          label: "Other",
          data: weeks.map((w) => w.time_other_min),
          backgroundColor: alpha(C.other, 0.9),
          borderColor: C.other,
          borderWidth: 1,
          yAxisID: "y",
        });
    }

    if (metric === "trimp") {
      if (sRun)
        arr.push({
          type: "bar" as const,
          label: "TRIMP (run)",
          data: weeks.map((w) => w.trimp_run),
          backgroundColor: alpha(C.run, 0.85),
          borderColor: C.run,
          borderWidth: 1,
          yAxisID: "y",
        });
      if (sBike)
        arr.push({
          type: "bar" as const,
          label: "TRIMP (bike)",
          data: weeks.map((w) => w.trimp_ride),
          backgroundColor: alpha(C.bike, 0.85),
          borderColor: C.bike,
          borderWidth: 1,
          yAxisID: "y",
        });
      if (sStrength)
        arr.push({
          type: "bar" as const,
          label: "TRIMP (strength)",
          data: weeks.map((w) => w.trimp_strength),
          backgroundColor: alpha(C.strength, 0.9),
          borderColor: C.strength,
          borderWidth: 1,
          yAxisID: "y",
        });
      if (sMixed)
        arr.push({
          type: "bar" as const,
          label: "TRIMP (mixed)",
          data: weeks.map((w) => w.trimp_mixed),
          backgroundColor: alpha(C.mixed, 0.9),
          borderColor: C.mixed,
          borderWidth: 1,
          yAxisID: "y",
        });
      if (sSkate)
        arr.push({
          type: "bar" as const,
          label: "TRIMP (skate)",
          data: weeks.map((w) => w.trimp_skate),
          backgroundColor: alpha(C.skate, 0.9),
          borderColor: C.skate,
          borderWidth: 1,
          yAxisID: "y",
        });
      if (sOther)
        arr.push({
          type: "bar" as const,
          label: "TRIMP (other)",
          data: weeks.map((w) => w.trimp_other),
          backgroundColor: alpha(C.other, 0.9),
          borderColor: C.other,
          borderWidth: 1,
          yAxisID: "y",
        });
    }

    // Indexy
    arr.push({
      type: "line" as const,
      label: "Monotony",
      data: monoSeries,
      yAxisID: "y1",
      borderColor: C.monotony,
      backgroundColor: C.monotony,
      tension: 0.3,
      pointRadius: 2,
      borderWidth: 3,
      spanGaps: true,
      order: 99,
    });
    arr.push({
      type: "line" as const,
      label: "Strain",
      data: strainSeries,
      yAxisID: "y2",
      borderColor: C.strain,
      backgroundColor: C.strain,
      tension: 0.3,
      pointRadius: 2,
      borderWidth: 3,
      borderDash: [4, 4],
      spanGaps: true,
      order: 99,
    });

    return arr;
  }, [
    weeks,
    metric,
    sRun,
    sBike,
    sStrength,
    sMixed,
    sSkate,
    sOther,
    monoSeries,
    strainSeries,
  ]);

  const data: ChartData<"bar" | "line", number[], string> = {
    labels,
    datasets,
  };

  const options: ChartOptions<"bar" | "line"> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { position: "top" },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const label = ctx.dataset.label || "";
            const v = ctx.parsed.y as number;
            if (ctx.dataset.yAxisID === "y1")
              return `${label}: ${v?.toFixed?.(2) ?? v}`;
            if (ctx.dataset.yAxisID === "y2")
              return `${label}: ${Math.round(v)}`;
            if (metric === "km") return `${label}: ${fmtKm(v)}`;
            if (metric === "time") return `${label}: ${fmtMin(v)}`;
            if (metric === "trimp") return `${label}: ${Math.round(v)} TRIMP`;
            return `${label}: ${v}`;
          },
        },
      },
    },
    onClick: (_evt, els) => {
      const idx = els?.[0]?.index;
      if (idx == null) return;
      const w = weeks[idx];
      if (!w) return;
      const pick = { week: w.week, start: w.start, end: w.end };
      setPicked(pick);
      onPickWeek?.(pick);
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: metric === "km" ? "km" : metric === "time" ? "min" : "TRIMP",
        },
        grid: { color: "rgba(255,255,255,0.07)" },
      },
      y1: {
        position: "right",
        min: 0,
        max: Math.max(3, Math.ceil(monoMax + 0.5)),
        grid: { drawOnChartArea: false },
        title: { display: true, text: "Monotony" },
      },
      y2: {
        position: "right",
        min: 0,
        max: Math.ceil(strainMax * 1.1),
        grid: { drawOnChartArea: false },
        title: { display: true, text: "Strain" },
      },
      x: { grid: { color: "rgba(255,255,255,0.05)" } },
    },
  };

  const helpText =
    metric === "km"
      ? "Rozdelenosť vzdialenosti podľa športu."
      : metric === "time"
      ? "Odtrénovaný čas podľa športu."
      : "TRIMP – intenzita × trvanie. Monotony ≈ konzistentnosť; Strain = TRIMP × Monotony.";

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded shadow relative">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-base font-semibold">Weekly Load</h3>

        <div className="flex items-center gap-3">
          {/* metrika */}
          <div className="flex items-center gap-1 text-xs">
            <span className="opacity-70">Zobraziť:</span>
            <button
              onClick={() => setMetric("km")}
              className={`px-2 py-1 rounded ${
                metric === "km" ? "bg-blue-600 text-white" : "bg-gray-700"
              }`}
            >
              Km
            </button>
            <button
              onClick={() => setMetric("time")}
              className={`px-2 py-1 rounded ${
                metric === "time" ? "bg-blue-600 text-white" : "bg-gray-700"
              }`}
            >
              Čas
            </button>
            <button
              onClick={() => setMetric("trimp")}
              className={`px-2 py-1 rounded ${
                metric === "trimp" ? "bg-blue-600 text-white" : "bg-gray-700"
              }`}
            >
              TRIMP
            </button>
          </div>

          {/* rozsah týždňov */}
          <div className="flex items-center gap-1 text-xs">
            <span className="opacity-70">Rozsah:</span>
            <select
              value={lookback}
              onChange={(e) => setLookback(Number(e.target.value))}
              className="px-2 py-1 rounded bg-gray-700"
              title="Počet týždňov v grafe"
            >
              <option value={8}>8 týždňov</option>
              <option value={12}>12 týždňov</option>
              <option value={26}>26 týždňov</option>
              <option value={52}>52 týždňov</option>
            </select>
          </div>

          {/* filtre športov */}
          <div className="flex items-center gap-2 text-xs">
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={sRun}
                onChange={(e) => setSRun(e.target.checked)}
              />{" "}
              Run
            </label>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={sBike}
                onChange={(e) => setSBike(e.target.checked)}
              />{" "}
              Bike
            </label>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={sStrength}
                onChange={(e) => setSStrength(e.target.checked)}
              />{" "}
              Strength
            </label>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={sMixed}
                onChange={(e) => setSMixed(e.target.checked)}
              />{" "}
              Mixed
            </label>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={sSkate}
                onChange={(e) => setSSkate(e.target.checked)}
              />{" "}
              Skate
            </label>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={sOther}
                onChange={(e) => setSOther(e.target.checked)}
              />{" "}
              Other
            </label>
          </div>

          {/* help */}
          <div className="relative">
            <button
              className="w-6 h-6 rounded-full bg-gray-700 hover:bg-gray-600 text-white text-xs"
              onClick={() => setShowHelp((v) => !v)}
              aria-label="Help"
              title="Čo je zobrazené?"
            >
              i
            </button>
            {showHelp && (
              <div className="absolute right-0 mt-2 w-80 text-sm bg-gray-900 text-gray-100 border border-gray-700 rounded shadow-xl p-3 z-10">
                <div className="font-semibold mb-1">Nápoveda</div>
                <p className="mb-2">{helpText}</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>
                    <b>Monotony</b>: čím bližšie k ~1, tým vyrovnanejší týždeň.
                  </li>
                  <li>
                    <b>Strain</b>: celkový týždenný stres (vyššie =
                    náročnejšie).
                  </li>
                  <li>
                    Pre <b>Čas</b> sú jednotky v minútach (tooltip formát:
                    h/min).
                  </li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ height: 360 }}>
        {loading ? (
          <div className="opacity-70 text-sm">Načítavam…</div>
        ) : (
          <MixedChart type="bar" data={data} options={options} />
        )}
      </div>

      {picked && (
        <WeeklySummary
          weeks={weeks as any}
          metric={metric}
          selectedWeek={picked.week}
        />
      )}
    </div>
  );
}
