// src/components/Activity/TrendWeeklyLoad.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
} from "chart.js";
import { API_URL } from "@/lib/config";
import { useUserId } from "@/lib/useUserId";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend
);

type WeekRow = {
  week: string; // napr. "2025-W36"
  label: string; // napr. "2025-W36"
  // vzdialenosti (km)
  km_run: number;
  km_ride: number;
  km_total: number;
  // časy (min)
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
  // indexy
  monotony: number; // y1
  strain: number; // y1
};

type Metric = "km" | "time" | "trimp";

const COLORS = {
  run: "rgba(56, 189, 248, 0.6)", // cyan-400
  ride: "rgba(168, 85, 247, 0.6)", // purple-500
  strength: "rgba(251, 191, 36, 0.6)", // amber-400
  other: "rgba(148, 163, 184, 0.6)", // slate-400
  lineMonotony: "rgba(34, 197, 94, 0.95)", // green-500
  lineStrain: "rgba(250, 204, 21, 0.95)", // yellow-400
};

function HelpBadge() {
  const [open, setOpen] = useState(false);
  return (
    <div className="ml-2 relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-xs px-2 py-1 rounded bg-slate-600 hover:bg-slate-500"
        title="Čo znamenajú metriky?"
      >
        i
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-72 text-sm bg-slate-800 text-slate-100 p-3 rounded shadow-xl z-10">
          <p className="font-semibold mb-1">Metriky</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <b>Km</b> – súčet vzdialenosti, rozdelený na Beh/Bike.
            </li>
            <li>
              <b>Čas</b> – minúty rozdelené na Beh/Bike/Sila/Iné.
            </li>
            <li>
              <b>TRIMP</b> – tréningový impulz (intenzita × čas), rozdelený
              podľa športu.
            </li>
            <li>
              <b>Monotony</b> – konzistentnosť (priemer / SD tréningovej záťaže;
              0–2 je ok, &gt;2 = riziko).
            </li>
            <li>
              <b>Strain</b> – Monotony × týždenný súčet záťaže.
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}

export default function TrendWeeklyLoad() {
  const { userId } = useUserId();

  // --- UI state (HOOKY VŽDY NA TOP-LEVELE!) ---
  const [metric, setMetric] = useState<Metric>("km");
  const [showRun, setShowRun] = useState(true);
  const [showRide, setShowRide] = useState(true);
  const [showStrength, setShowStrength] = useState(true);
  const [showOther, setShowOther] = useState(false);
  const [weeks, setWeeks] = useState<WeekRow[]>([]);
  const [loading, setLoading] = useState(true);

  // --- fetch ---
  useEffect(() => {
    if (!userId) return;
    (async () => {
      setLoading(true);
      try {
        const url = `${API_URL}/analytics/weekly/${userId}?weeks=12`;
        const res = await fetch(url);
        const json = await res.json();
        console.log("[FE] /analytics/weekly json →", json);

        // očakávame pole v json.weeks; niektoré implementácie vracajú json.data
        const raw: any[] = Array.isArray(json?.weeks)
          ? json.weeks
          : Array.isArray(json?.data)
          ? json.data
          : [];

        // 🔧 normalizácia názvov + čísel (string -> number)
        const toNum = (v: any) =>
          v == null || v === "" ? 0 : typeof v === "number" ? v : Number(v);

        const normalize = (w: any) => {
          // podporíme aj alternatívne mená kľúčov (pre prípad, že BE vracia inak)
          return {
            week: w.week ?? w.iso_week ?? w.isoWeek ?? "",
            label: w.label ?? w.week_label ?? w.week ?? "",
            // km
            km_run: toNum(w.km_run ?? w.run_km ?? w.dist_run_km ?? w.kmRun),
            km_ride: toNum(
              w.km_ride ?? w.ride_km ?? w.dist_ride_km ?? w.kmRide
            ),
            km_total: toNum(w.km_total ?? w.total_km ?? w.kmTotal),
            // čas (min)
            time_run_min: toNum(w.time_run_min ?? w.run_min ?? w.run_time_min),
            time_ride_min: toNum(
              w.time_ride_min ?? w.ride_min ?? w.ride_time_min
            ),
            time_strength_min: toNum(
              w.time_strength_min ?? w.strength_min ?? w.gym_min
            ),
            time_other_min: toNum(w.time_other_min ?? w.other_min),
            // TRIMP
            trimp_run: toNum(w.trimp_run ?? w.run_trimp),
            trimp_bike: toNum(w.trimp_bike ?? w.bike_trimp),
            trimp_strength: toNum(w.trimp_strength ?? w.strength_trimp),
            trimp_other: toNum(w.trimp_other ?? w.other_trimp),
            trimp: toNum(w.trimp ?? w.total_trimp),
            // indexy
            monotony: toNum(w.monotony),
            strain: toNum(w.strain),
          };
        };

        const norm = raw.map(normalize);

        console.table(norm.slice(-5)); // posledných 5 týždňov do konzoly
        setWeeks(norm);
      } catch (e) {
        console.error("[FE] weekly load error:", e);
        setWeeks([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  const labels = useMemo(() => weeks.map((w) => w.label), [weeks]);

  // --- bar datasety (len výpočet, žiadne nové hooky) ---
  const barDatasets = useMemo(() => {
    const ds: any[] = [];

    if (metric === "km") {
      if (showRun) {
        ds.push({
          type: "bar",
          label: "Km (run)",
          data: weeks.map((w) => w.km_run ?? 0),
          backgroundColor: COLORS.run,
          borderColor: COLORS.run.replace("0.6", "1"),
          borderWidth: 1,
          yAxisID: "yMain",
          stack: "km",
        });
      }
      if (showRide) {
        ds.push({
          type: "bar",
          label: "Km (bike)",
          data: weeks.map((w) => w.km_ride ?? 0),
          backgroundColor: COLORS.ride,
          borderColor: COLORS.ride.replace("0.6", "1"),
          borderWidth: 1,
          yAxisID: "yMain",
          stack: "km",
        });
      }
    }

    if (metric === "time") {
      if (showRun) {
        ds.push({
          type: "bar",
          label: "Čas beh (min)",
          data: weeks.map((w) => w.time_run_min ?? 0),
          backgroundColor: COLORS.run,
          borderColor: COLORS.run.replace("0.6", "1"),
          borderWidth: 1,
          yAxisID: "yMain",
          stack: "time",
        });
      }
      if (showRide) {
        ds.push({
          type: "bar",
          label: "Čas bike (min)",
          data: weeks.map((w) => w.time_ride_min ?? 0),
          backgroundColor: COLORS.ride,
          borderColor: COLORS.ride.replace("0.6", "1"),
          borderWidth: 1,
          yAxisID: "yMain",
          stack: "time",
        });
      }
      if (showStrength) {
        ds.push({
          type: "bar",
          label: "Čas sila (min)",
          data: weeks.map((w) => w.time_strength_min ?? 0),
          backgroundColor: COLORS.strength,
          borderColor: COLORS.strength.replace("0.6", "1"),
          borderWidth: 1,
          yAxisID: "yMain",
          stack: "time",
        });
      }
      if (showOther) {
        ds.push({
          type: "bar",
          label: "Čas iné (min)",
          data: weeks.map((w) => w.time_other_min ?? 0),
          backgroundColor: COLORS.other,
          borderColor: COLORS.other.replace("0.6", "1"),
          borderWidth: 1,
          yAxisID: "yMain",
          stack: "time",
        });
      }
    }

    if (metric === "trimp") {
      if (showRun) {
        ds.push({
          type: "bar",
          label: "TRIMP beh",
          data: weeks.map((w) => w.trimp_run ?? 0),
          backgroundColor: COLORS.run,
          borderColor: COLORS.run.replace("0.6", "1"),
          borderWidth: 1,
          yAxisID: "yMain",
          stack: "trimp",
        });
      }
      if (showRide) {
        ds.push({
          type: "bar",
          label: "TRIMP bike",
          data: weeks.map((w) => w.trimp_bike ?? 0),
          backgroundColor: COLORS.ride,
          borderColor: COLORS.ride.replace("0.6", "1"),
          borderWidth: 1,
          yAxisID: "yMain",
          stack: "trimp",
        });
      }
      if (showStrength) {
        ds.push({
          type: "bar",
          label: "TRIMP sila",
          data: weeks.map((w) => w.trimp_strength ?? 0),
          backgroundColor: COLORS.strength,
          borderColor: COLORS.strength.replace("0.6", "1"),
          borderWidth: 1,
          yAxisID: "yMain",
          stack: "trimp",
        });
      }
      if (showOther) {
        ds.push({
          type: "bar",
          label: "TRIMP iné",
          data: weeks.map((w) => w.trimp_other ?? 0),
          backgroundColor: COLORS.other,
          borderColor: COLORS.other.replace("0.6", "1"),
          borderWidth: 1,
          yAxisID: "yMain",
          stack: "trimp",
        });
      }
    }

    // čiary – pravá os
    ds.push({
      type: "line",
      label: "Monotony",
      data: weeks.map((w) => w.monotony ?? 0),
      borderColor: COLORS.lineMonotony,
      backgroundColor: COLORS.lineMonotony,
      yAxisID: "yIdx",
      tension: 0.25,
      pointRadius: 2,
      borderWidth: 2,
      order: 0,
    });

    ds.push({
      type: "line",
      label: "Strain",
      data: weeks.map((w) => w.strain ?? 0),
      borderColor: COLORS.lineStrain,
      backgroundColor: COLORS.lineStrain,
      yAxisID: "yIdx",
      tension: 0.25,
      pointRadius: 2,
      borderWidth: 2,
      order: 0,
    });

    return ds;
  }, [metric, showRun, showRide, showStrength, showOther, weeks]);

  const data = useMemo(
    () => ({
      labels,
      datasets: barDatasets,
    }),
    [labels, barDatasets]
  );

  const unitLeft = metric === "km" ? "km" : metric === "time" ? "min" : "TRIMP";

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: "top" as const,
          labels: { color: "#cbd5e1" },
        },
        tooltip: {
          mode: "index" as const,
          intersect: false,
        },
      },
      scales: {
        yMain: {
          type: "linear" as const,
          position: "left" as const,
          grid: { color: "rgba(148,163,184,0.2)" },
          ticks: {
            color: "#cbd5e1",
            callback: (v: any) => `${v} ${unitLeft}`,
          },
          beginAtZero: true,
        },
        yIdx: {
          type: "linear" as const,
          position: "right" as const,
          grid: { drawOnChartArea: false },
          ticks: { color: "#e5e7eb" },
          beginAtZero: true,
        },
        x: {
          grid: { color: "rgba(148,163,184,0.15)" },
          ticks: { color: "#cbd5e1" },
        },
      },
    }),
    [unitLeft]
  );

  if (loading) return <div>Načítavam…</div>;
  if (!weeks.length) return <div>Žiadne dáta.</div>;

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded shadow">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">Weekly Load</h3>
          <HelpBadge />
        </div>

        <div className="flex items-center gap-4 text-sm">
          {/* Metric selector */}
          <div className="flex items-center gap-2">
            <span className="opacity-70">Zobraziť:</span>
            {(["km", "time", "trimp"] as Metric[]).map((m) => (
              <button
                key={m}
                onClick={() => setMetric(m)}
                className={`px-2 py-1 rounded ${
                  metric === m
                    ? "bg-blue-600 text-white"
                    : "bg-slate-600 text-slate-100"
                }`}
              >
                {m === "km" ? "Km" : m === "time" ? "Čas" : "TRIMP"}
              </button>
            ))}
          </div>

          {/* Sport filters */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={showRun}
                onChange={(e) => setShowRun(e.target.checked)}
              />
              <span>Beh</span>
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={showRide}
                onChange={(e) => setShowRide(e.target.checked)}
              />
              <span>Bike</span>
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={showStrength}
                onChange={(e) => setShowStrength(e.target.checked)}
                disabled={metric === "km"} // pri km nedáva zmysel
              />
              <span className={metric === "km" ? "opacity-40" : ""}>Sila</span>
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={showOther}
                onChange={(e) => setShowOther(e.target.checked)}
                disabled={metric === "km"} // pri km nedáva zmysel
              />
              <span className={metric === "km" ? "opacity-40" : ""}>Iné</span>
            </label>
          </div>
        </div>
      </div>

      <div style={{ height: 360 }}>
        <Bar data={data} options={options} />
      </div>
    </div>
  );
}
