// src/features/activity/components/ActivityDetail.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { CARD } from "@/shared/ui/classes";
import { THEME } from "@/shared/theme/tokens";
import { useActivityData } from "@/features/activity/data/ActivityDataProvider";
import { fmtSecondsHMS, fmtDistance } from "@/shared/utils/format";

interface Props { activityId: number; }

/* Small helper to format mm:ss pre osi X */
function fmtT(s: number) {
  if (!Number.isFinite(s) || s < 0) return "";
  return fmtSecondsHMS(s);
}

/** Reusable HR chart (SVG) s osami, mriežkou a dvomi veľkosťami */
function HRSparkline({
  times, hrs, height = 140, big = false, avgHr,
}: {
  times: number[];           // sekundy od začiatku
  hrs: (number | null)[];
  height?: number;           // výška SVG
  big?: boolean;             // keď true, širšie okraje + viac tickov
  avgHr?: number | null;     // voliteľná priemerka
}) {
  const W = big ? 840 : 640;
  const H = height;
  const padL = big ? 42 : 32;   // ľavá os
  const padR = 12;
  const padT = 12;
  const padB = big ? 28 : 24;   // spodná os

  const n = Math.min(times.length, hrs.length);
  if (n === 0) {
    return <div className="opacity-70 text-sm">HR stream nie je k dispozícii.</div>;
  }

  // vyčistíme NaN/null
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < n; i++) {
    const y = hrs[i];
    if (y == null) continue;
    xs.push(times[i]);
    ys.push(y);
  }
  if (ys.length === 0) {
    return <div className="opacity-70 text-sm">HR stream nie je k dispozícii.</div>;
  }

  const minX = 0;
  const maxX = Math.max(1, xs[xs.length - 1]); // celkové trvanie
  const minYraw = Math.min(...ys);
  const maxYraw = Math.max(...ys);

  // trocha “headroomu”, nech krivka neleží na okraji
  const minY = Math.floor((minYraw - 2) / 5) * 5;
  const maxY = Math.ceil((maxYraw + 2) / 5) * 5;

  const sx = (v: number) =>
    padL + ((v - minX) / (maxX - minX)) * (W - padL - padR);
  const sy = (v: number) =>
    padT + (1 - (v - minY) / (maxY - minY)) * (H - padT - padB);

  // polyline path
  let d = `M ${sx(xs[0])} ${sy(ys[0])}`;
  for (let i = 1; i < xs.length; i++) d += ` L ${sx(xs[i])} ${sy(ys[i])}`;

  // Y ticks (4–5 štítkov)
  const yTicks: number[] = [];
  const ySteps = 4;
  for (let i = 0; i <= ySteps; i++) {
    const t = minY + ((maxY - minY) * i) / ySteps;
    yTicks.push(Math.round(t));
  }

  // X ticks: 0%, 25%, 50%, 75%, 100% → v sekundách
  const xTicks = [0, 0.25, 0.5, 0.75, 1].map((p) => Math.round(maxX * p));

  const gridColor = THEME.chart.grid ?? "rgba(255,255,255,0.15)";
  const lineColor = THEME.chart.run ?? "#22D3EE";

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="HR priebeh">
      {/* pozadie */}
      <rect x="0" y="0" width={W} height={H} fill="transparent" />

      {/* mriežka Y */}
      {yTicks.map((v, i) => (
        <g key={`gy-${i}`}>
          <line x1={padL} x2={W - padR} y1={sy(v)} y2={sy(v)} stroke={gridColor} strokeDasharray="3 4" />
          <text x={padL - 6} y={sy(v)} textAnchor="end" dominantBaseline="central" fontSize={10} fill="#cbd5e1">
            {v}
          </text>
        </g>
      ))}

      {/* mriežka X */}
      {xTicks.map((sec, i) => (
        <g key={`gx-${i}`}>
          <line x1={sx(sec)} x2={sx(sec)} y1={padT} y2={H - padB} stroke={gridColor} strokeDasharray="3 4" />
          <text x={sx(sec)} y={H - 6} textAnchor="middle" fontSize={10} fill="#cbd5e1">
            {fmtT(sec)}
          </text>
        </g>
      ))}

      {/* priemer HR */}
      {Number.isFinite(avgHr as number) && (
        <line
          x1={padL}
          x2={W - padR}
          y1={sy(avgHr as number)}
          y2={sy(avgHr as number)}
          stroke={THEME.chart.gridSoft ?? "rgba(255,255,255,0.25)"}
          strokeDasharray="6 4"
        />
      )}

      {/* krivka */}
      <path d={d} fill="none" stroke={lineColor} strokeWidth={big ? 2.5 : 2} />

      {/* osi */}
      <line x1={padL} x2={padL} y1={padT} y2={H - padB} stroke={gridColor} />
      <line x1={padL} x2={W - padR} y1={H - padB} y2={H - padB} stroke={gridColor} />

      {/* popisky osí */}
      <text x={padL - 18} y={padT + 8} textAnchor="start" fontSize={10} fill="#9ca3af">bpm</text>
      <text x={W - padR} y={H - padB + 14} textAnchor="end" fontSize={10} fill="#9ca3af">čas</text>
    </svg>
  );
}

export default function ActivityDetail({ activityId }: Props) {
  const { getSummary, getDetail, getStreams } = useActivityData();
  const [loading, setLoading] = useState(true);
  const [laps, setLaps] = useState<any[]>([]);
  const [splits, setSplits] = useState<any[]>([]);
  const [hrXs, setHrXs] = useState<number[]>([]);
  const [hrYs, setHrYs] = useState<(number | null)[]>([]);
  const [duration, setDuration] = useState<number>(0);
  const [open, setOpen] = useState(false);

  const summary = getSummary(activityId);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const extra = await getDetail(activityId);
      const streams = await getStreams(activityId);
      if (!alive) return;
      setLaps(extra.laps || []);
      setSplits(extra.splits || []);
      setHrXs(streams.time_s || []);
      setHrYs(streams.hr || []);
      setDuration(streams.duration_s || 0);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [activityId, getDetail, getStreams]);

  if (!summary) return <div>❌ Aktivita sa nenašla v 90-d range cache.</div>;

  const distTxt = fmtDistance(summary.distance_m ?? null);
  const timeTxt = summary.moving_time_s != null ? fmtSecondsHMS(summary.moving_time_s) : "—";

  const panel = (
    <>
      <h4 className="font-bold">HR priebeh</h4>
      <div className="mt-1">
        <HRSparkline
          times={hrXs}
          hrs={hrYs}
          height={140}
          big={false}
          avgHr={summary.average_heartrate_bpm ?? null}
        />
      </div>
      <div className="mt-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-xs"
        >
          Zväčšiť graf
        </button>
      </div>
    </>
  );

  return (
    <div className={`${CARD} space-y-2`}>
      <h3 className="text-lg font-bold">{summary.name}</h3>

      <p>
        <strong>Date:</strong>{" "}
        {new Date(summary.date).toLocaleString(THEME.i18n.dateLocale, {
          day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
        })}
      </p>

      <p><strong>Distance:</strong> {distTxt}</p>
      <p><strong>Time:</strong> {timeTxt}</p>
      <p><strong>Avg HR:</strong> {summary.average_heartrate_bpm ?? "—"}</p>
      <p><strong>Max HR:</strong> {summary.max_heartrate_bpm ?? "—"}</p>

      {loading && <div>Načítavam detail (laps/splits)…</div>}

      {/* HR panel */}
      {!loading && panel}

      {/* Laps */}
      {!loading && !!laps.length && (
        <>
          <h4 className="font-bold mt-3">Laps</h4>
          <ul className="list-disc pl-5">
            {laps.map((lap, idx) => (
              <li key={lap.lap_index ?? idx}>
                Lap {lap.lap_index ?? idx}: {fmtDistance(lap.distance_m)}, {fmtSecondsHMS(lap.moving_time_s)}
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Splits */}
      {!loading && !!splits.length && (
        <>
          <h4 className="font-bold mt-3">Splits</h4>
          <ul className="list-disc pl-5">
            {splits.map((split, idx) => (
              <li key={split.split_index ?? idx}>
                Split {split.split_index ?? idx}: {fmtDistance(split.distance_m)}, {fmtSecondsHMS(split.moving_time_s)}
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Fullscreen overlay pre zväčšený graf */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Zväčšený HR graf"
        >
          <div
            className="bg-gray-800 rounded shadow-xl max-w-[1000px] w-full p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold">HR priebeh (detail)</h4>
              <button
                onClick={() => setOpen(false)}
                className="px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-xs"
              >
                Zavrieť
              </button>
            </div>
            <HRSparkline
              times={hrXs}
              hrs={hrYs}
              height={240}
              big={true}
              avgHr={summary.average_heartrate_bpm ?? null}
            />
            <div className="mt-2 text-xs opacity-80">
              Trvanie: {fmtT(duration)} • priemer HR: {summary.average_heartrate_bpm ?? "—"} bpm
            </div>
          </div>
        </div>
      )}
    </div>
  );
}