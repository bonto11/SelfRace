"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartData,
  ChartOptions,
} from "chart.js";
import { Chart as MixedChart, getElementAtEvent } from "react-chartjs-2";
import WeeklySummary from "@/components/Activity/WeeklySummary";
import { API_URL } from "@/lib/config";
import { useUserId } from "@/lib/useUserId";

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
  start: string;   // YYYY-MM-DD  (NEW)
  end: string;     // YYYY-MM-DD  (NEW)
  // km
  km_run: number;
  km_ride: number;
  km_total: number;
  // time
  time_min: number;              // 👈 total
  time_run_min: number;
  time_ride_min: number;
  time_strength_min: number;
  time_other_min: number;
  // TRIMP
  trimp_run: number;
  trimp_bike: number;
  trimp_strength: number;
  trimp_other: number;
  trimp: number;
  // indexy – objekt podľa metriky
  monotony: { km?: number; time?: number; trimp?: number };
  strain:   { km?: number; time?: number; trimp?: number };
};

const C = {
  run: "#22D3EE",      // cyan-400
  bike: "#A78BFA",     // violet-400
  strength: "#F59E0B", // amber-500
  other: "#9CA3AF",    // gray-400
  monotony: "#84CC16", // lime-400
  strain: "#FDE047",   // yellow-300
};

const alpha = (hex: string, a: number) =>
  `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(
    hex.slice(3, 5),
    16
  )},${parseInt(hex.slice(5, 7), 16)},${a})`;

const fmtMin = (m: number) => {
  const mm = Math.round(m || 0);
  if (mm < 60) return `${mm} min`;
  const h = Math.floor(mm / 60);
  const r = mm % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
};
const fmtKm = (v: number) => `${(v || 0).toFixed(1)} km`;

export type WeekPick = { week: string; start: string; end: string };

export default function TrendWeeklyLoad({onPickWeek,}: { onPickWeek?: (w: WeekPick) => void;}) {
  const { userId } = useUserId();

  const [metric, setMetric] = useState<Metric>("km");
  const [sRun, setSRun] = useState(true);
  const [sBike, setSBike] = useState(true);
  const [sStrength, setSStrength] = useState(true);
  const [sOther, setSOther] = useState(false);

  const [weeks, setWeeks] = useState<WeekRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [picked, setPicked] = useState<{week:string,start:string,end:string}|null>(null);


  // fetch + normalizácia
  useEffect(() => {
    if (!userId) return;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/analytics/weekly/${userId}?weeks=12`);
        const json = await res.json();

        const raw: any[] = Array.isArray(json?.weeks)
          ? json.weeks
          : Array.isArray(json?.data)
          ? json.data
          : [];

        const toNum = (v: any) => {
          const n = Number(v);
          return Number.isFinite(n) ? n : 0;
        };

        const norm: WeekRow[] = raw.map((w) => ({
          week: w.week ?? w.iso_week ?? w.label ?? "",
          label: w.label ?? w.week ?? w.iso_week ?? "",
          start: w.start ?? "",                // NEW
          end:   w.end ?? "",                  // NEW
          km_run: toNum(w.km_run ?? w.run_km ?? w.dist_run_km),
          km_ride: toNum(w.km_ride ?? w.ride_km ?? w.dist_ride_km ?? w.km_bike),
          km_total: toNum(w.km_total ?? w.total_km),

          time_min: toNum(w.time_min ?? w.total_min ?? w.total_time_min),
          time_run_min: toNum(w.time_run_min ?? w.run_min ?? w.run_time_min),
          time_ride_min: toNum(w.time_ride_min ?? w.ride_min ?? w.ride_time_min),
          time_strength_min: toNum(w.time_strength_min ?? w.strength_min ?? w.gym_min),
          time_other_min: toNum(w.time_other_min ?? w.other_min),

          trimp_run: toNum(w.trimp_run ?? w.run_trimp),
          trimp_bike: toNum(w.trimp_bike ?? w.bike_trimp ?? w.trimp_ride),
          trimp_strength: toNum(w.trimp_strength ?? w.strength_trimp),
          trimp_other: toNum(w.trimp_other ?? w.other_trimp),
          trimp: toNum(w.trimp ?? w.total_trimp),

          monotony: w.monotony ?? {},
          strain:   w.strain ?? {},
        }));

        console.table(
          norm.map((w) => ({
            week: w.week,
            km: w.km_total,
            time_min: w.time_min,
            trimp: w.trimp,
            mono_km: w.monotony.km,
            mono_time: w.monotony.time,
            mono_trimp: w.monotony.trimp,
            strain_km: w.strain.km,
            strain_time: w.strain.time,
            strain_trimp: w.strain.trimp,
          }))
        );

        setWeeks(norm);
      } catch (e) {
        console.error("[FE] weekly error:", e);
        setWeeks([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  const chartRef = useRef<any>(null);

  function handleChartClick(evt: React.MouseEvent<HTMLCanvasElement>) {
    if (!chartRef.current) return;
    const elems = getElementAtEvent(chartRef.current, evt);
    if (!elems.length) return;
    const idx = elems[0].index;
    const w = weeks[idx];
    if (!w) return;
    onPickWeek?.({ week: w.week, start: w.start, end: w.end });

    console.log("click", elems, idx, weeks[idx]);
  }

  const labels = useMemo(() => weeks.map((w) => w.label || w.week), [weeks]);

  // série indexov viazané na vybranú metriku
  const monoSeries = useMemo(
    () => weeks.map((w) => (w.monotony?.[metric] ?? null)),
    [weeks, metric]
  );
  const strainSeries = useMemo(
    () => weeks.map((w) => (w.strain?.[metric] ?? null)),
    [weeks, metric]
  );

  const monoMax = Math.max(1, ...monoSeries.filter((v): v is number => v != null));
  const strainMax = Math.max(1, ...strainSeries.filter((v): v is number => v != null));
  

  // datasety
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
          data: weeks.map((w) => w.trimp_bike),
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

    // Monotony (pravá os y1)
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

    // Strain (druhá pravá os y2)
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
  }, [weeks, metric, sRun, sBike, sStrength, sOther, monoSeries, strainSeries]);

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

            if (ctx.dataset.yAxisID === "y1") return `${label}: ${v?.toFixed?.(2) ?? v}`;
            if (ctx.dataset.yAxisID === "y2") return `${label}: ${Math.round(v)}`;

            if (metric === "km") return `${label}: ${fmtKm(v)}`;
            if (metric === "time") return `${label}: ${fmtMin(v)}`;
            if (metric === "trimp") return `${label}: ${Math.round(v)} TRIMP`;
            return `${label}: ${v}`;
          },
        },
      },
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
      x: {
        grid: { color: "rgba(255,255,255,0.05)" },
      },
    },
    onClick: (_evt, els) => {
    const idx = els?.[0]?.index;
    if (idx != null) {
      const w = weeks[idx];
      setPicked({ week: w.week, start: w.start, end: w.end });
      // ak filtruješ tabuľku:
      onPickWeek?.({ week: w.week, start: w.start, end: w.end });
    }
},
  };

  const helpText =
    metric === "km"
      ? "Rozdelenosť vzdialenosti podľa športu."
      : metric === "time"
      ? "Odtrénovaný čas podľa športu."
      : "TRIMP – tréningový impulz (intenzita × trvanie). Monotony = týždenná konzistentnosť; Strain = celkový stres (TRIMP × Monotony).";

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
              className={`px-2 py-1 rounded ${metric === "km" ? "bg-blue-600 text-white" : "bg-gray-700"}`}
            >
              Km
            </button>
            <button
              onClick={() => setMetric("time")}
              className={`px-2 py-1 rounded ${metric === "time" ? "bg-blue-600 text-white" : "bg-gray-700"}`}
            >
              Čas
            </button>
            <button
              onClick={() => setMetric("trimp")}
              className={`px-2 py-1 rounded ${metric === "trimp" ? "bg-blue-600 text-white" : "bg-gray-700"}`}
            >
              TRIMP
            </button>
          </div>

          {/* filtre športov */}
          <div className="flex items-center gap-2 text-xs">
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={sRun} onChange={(e) => setSRun(e.target.checked)} />
              Beh
            </label>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={sBike} onChange={(e) => setSBike(e.target.checked)} />
              Bike
            </label>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={sStrength} onChange={(e) => setSStrength(e.target.checked)} />
              Sila
            </label>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={sOther} onChange={(e) => setSOther(e.target.checked)} />
              Iné
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
                  <li><b>Monotony</b>: čím bližšie k ~1, tým vyrovnanejší týždeň.</li>
                  <li><b>Strain</b>: celkový týždenný stres (vyššie = náročnejšie).</li>
                  <li>Pre <b>Čas</b> sú jednotky v minútach (tooltip formát: h/min).</li>
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
          <MixedChart 
          ref={chartRef}
          type="bar" 
          data={data} 
          options={options}
          onClick={handleChartClick} />
        )}
      </div>
      <WeeklySummary
        weeks={weeks as any}
        metric={metric}
        selectedWeek={picked?.week ?? weeks.at(-1)?.week}
      />
    </div>
  );
}