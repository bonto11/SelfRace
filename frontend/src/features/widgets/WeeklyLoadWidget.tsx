"use client";

import { useEffect, useMemo, useState } from "react";
import { Chart as MixedChart } from "react-chartjs-2";
import type { ChartData, ChartOptions } from "chart.js";
import { ensureChartJSRegistered } from "@/shared/charts/register";
import { API_URL } from "@/shared/config";
import { THEME } from "@/shared/theme/tokens";
import { useUserId } from "@/shared/hooks/useUserId";

ensureChartJSRegistered();

type WeekRow = {
  week: string; label: string; start: string; end: string;
  time_run_min: number; time_ride_min: number; time_strength_min: number;
  time_mixed_min: number; time_skate_min: number; time_other_min: number;
};

const C = { run:"#22D3EE", bike:"#A78BFA", strength:"#F59E0B", mixed:"#34D399", skate:"#60A5FA", other:"#9CA3AF" };
const a = (hex:string, alpha:number) =>
  `rgba(${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)},${alpha})`;

function hasAny(data:number[]) { return data.some(v => (v ?? 0) > 0); }

export type WeekPick = { week: string; start: string; end: string };

export default function WeeklyLoadWidget({
  title = "Weekly Load",
  onPickWeek,
  onOpenDetail,
}: {
  title?: string;
  onPickWeek?: (w: WeekPick) => void;
  onOpenDetail?: () => void;
}) {
  const { userId } = useUserId();
  const [weeks, setWeeks] = useState<WeekRow[]>([]);
  const [loading, setLoading] = useState(false);

  // MINI: vždy 2 týždne
  useEffect(() => {
    if (!userId) return;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/analytics/weekly/${userId}?weeks=${THEME.mobile.miniWeeks}`);
        const json = await res.json().catch(() => ({}));
        const raw: any[] = Array.isArray(json?.weeks) ? json.weeks : Array.isArray(json?.data) ? json.data : [];
        const num = (v:any) => (Number.isFinite(+v) ? +v : 0);
        const norm: WeekRow[] = raw.map((w) => ({
          week: w.week ?? w.iso_week ?? w.label ?? "",
          label: w.label ?? w.week ?? w.iso_week ?? "",
          start: w.start ?? "",
          end: w.end ?? "",
          time_run_min: num(w.time_run_min ?? w.run_min),
          time_ride_min: num(w.time_ride_min ?? w.ride_min),
          time_strength_min: num(w.time_strength_min ?? w.strength_min ?? w.gym_min),
          time_mixed_min: num(w.time_mixed_min),
          time_skate_min: num(w.time_skate_min),
          time_other_min: num(w.time_other_min ?? w.other_min),
        }));
        setWeeks(norm);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  const labels = useMemo(() => weeks.map(w => w.label || w.week), [weeks]);

  const dsTimeRun      = weeks.map(w => w.time_run_min);
  const dsTimeRide     = weeks.map(w => w.time_ride_min);
  const dsTimeStrength = weeks.map(w => w.time_strength_min);
  const dsTimeMixed    = weeks.map(w => w.time_mixed_min);
  const dsTimeSkate    = weeks.map(w => w.time_skate_min);
  const dsTimeOther    = weeks.map(w => w.time_other_min);

  const datasets = useMemo(() => {
    const ds:any[] = [];
    const push = (label:string, data:number[], color:string) => ds.push({
      type:"bar" as const, label, data,
      backgroundColor: a(color, 0.85), borderColor: color, borderWidth: 1, yAxisID:"y",
      // tu sú "štíhle" stĺpce – bez TS chyby (na dataset-e)
      barPercentage: 0.7, categoryPercentage: 0.6, maxBarThickness: 12,
    });

    if (hasAny(dsTimeRun))      push("Run",      dsTimeRun,      C.run);
    if (hasAny(dsTimeRide))     push("Bike",     dsTimeRide,     C.bike);
    if (hasAny(dsTimeStrength)) push("Strength", dsTimeStrength, C.strength);
    if (hasAny(dsTimeMixed))    push("Mixed",    dsTimeMixed,    C.mixed);
    if (hasAny(dsTimeSkate))    push("Skate",    dsTimeSkate,    C.skate);
    if (hasAny(dsTimeOther))    push("Other",    dsTimeOther,    C.other);

    return ds;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weeks]);

  const data: ChartData<"bar"|"line", number[], string> = { labels, datasets };

  const options: ChartOptions<"bar"|"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { display: false }, // vlastná mini-legenda pod headerom
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const label = ctx.dataset.label || "";
            const v = (ctx.parsed.y ?? 0) as number;
            const mm = Math.round(v);
            if (mm < 60) return `${label}: ${mm} min`;
            const h = Math.floor(mm / 60), r = mm % 60;
            return `${label}: ${h} h${r ? ` ${r} min` : ""}`;
          },
        },
      },
    },
    layout: { padding: { left: 8, right: 12 } },
    scales: {
      y: {
        beginAtZero: true,
        title: { display: true, text: "min" },
        grid: { color: THEME.chart.grid },
      },
      x: { grid: { color: THEME.chart.gridSoft }, ticks: { maxRotation: 0, autoSkip: true } },
    },
    onClick: (_e, els) => {
      const idx = els?.[0]?.index;
      if (idx == null) return;
      const w = weeks[idx];
      if (!w) return;
      onPickWeek?.({ week: w.week, start: w.start, end: w.end });
    },
  };

  // vlastná minilegenda – iba športy, ktoré sa naozaj vyskytujú
  const pills = [
    hasAny(dsTimeRun)      ? { k: "Run",      c: C.run }      : null,
    hasAny(dsTimeRide)     ? { k: "Bike",     c: C.bike }     : null,
    hasAny(dsTimeStrength) ? { k: "Strength", c: C.strength } : null,
    hasAny(dsTimeMixed)    ? { k: "Mixed",    c: C.mixed }    : null,
    hasAny(dsTimeSkate)    ? { k: "Skate",    c: C.skate }    : null,
    hasAny(dsTimeOther)    ? { k: "Other",    c: C.other }    : null,
  ].filter(Boolean) as { k: string; c: string }[];

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded shadow relative max-w-full overflow-hidden">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
        <h3 className="text-base font-semibold">{title}</h3>
        <div className="flex items-center gap-3">
          {/* mini legenda – text vo farbe série */}
          <div className="hidden sm:flex items-center gap-3 text-xs">
            {pills.map(p => (
              <span key={p.k} style={{ color: p.c }}>{p.k}</span>
            ))}
          </div>
          <button onClick={onOpenDetail} className="text-xs px-2 py-1 rounded bg-gray-700">
            Detail
          </button>
        </div>
      </div>

      {loading ? (
        <div className="opacity-70 text-sm">Načítavam…</div>
      ) : (
        <div style={{ height: THEME.chart.weeklyHeightCompact }}>
          <MixedChart type="bar" data={data} options={options} />
          <div className="mt-2 text-xs opacity-70">{THEME.copy.rotateHint}</div>
        </div>
      )}
    </div>
  );
}
