// src/features/activity/components/ActivityDetail.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { CARD } from "@/shared/ui/classes";
import { THEME } from "@/shared/theme/tokens";
import { useActivityData } from "@/features/activity/data/ActivityDataProvider";
import { fmtSecondsHMS, fmtDistance } from "@/shared/utils/format";
import HrChart from "@/features/activity/components/HrChart";

interface Props { activityId: number; }
type StreamsData = { time_s: number[]; hr: (number | null)[]; duration_s: number };

// --- FIXED COLORS (no theme lookups) ---
const COL = {
  z1: "#60A5FA",   // blue
  z2: "#34D399",   // green
  z3: "#FBBF24",   // yellow
  z4: "#F97316",   // orange
  z5: "#EF4444",   // red
  grid: "rgba(255,255,255,.15)",
};

// --- FIXED HR ZONES (no theme / no user profile yet) ---
const HR_MAX = 207;
const CUTS: [number, number, number, number] = [154, 173, 183, 193]; // Z1..Z4 max

function zoneColor(hr: number) {
  if (hr <= CUTS[0]) return COL.z1;
  if (hr <= CUTS[1]) return COL.z2;
  if (hr <= CUTS[2]) return COL.z3;
  if (hr <= CUTS[3]) return COL.z4;
  return COL.z5;
}

export default function ActivityDetail({ activityId }: Props) {
  const { getSummary, getStreams, getDetail } = useActivityData();
  const summary = getSummary(activityId);

  const [loading, setLoading] = useState(true);
  const [streams, setStreams] = useState<StreamsData>({ time_s: [], hr: [], duration_s: 0 });
  const [laps, setLaps] = useState<any[]>([]);
  const [splits, setSplits] = useState<any[]>([]);
  const [showLarge, setShowLarge] = useState(false);
  const [showFull, setShowFull] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const s = await getStreams(activityId);
      const extra = await getDetail(activityId);
      if (!alive) return;
      setStreams(s);
      setLaps(extra.laps || []);
      setSplits(extra.splits || []);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [activityId, getStreams, getDetail]);

  if (!summary) return <div>❌ Aktivita sa nenašla v 90-d range cache.</div>;

  const distTxt = fmtDistance(summary.distance_m ?? null);
  const timeTxt = summary.moving_time_s != null ? fmtSecondsHMS(summary.moving_time_s) : "—";

  // ------- HR mini chart (SVG) -------
  const Chart = useMemo(() => {
    const n = Math.min(streams.time_s.length, streams.hr.length);
    if (!n) return () => <div className="opacity-70 text-sm">HR stream nie je k dispozícii.</div>;

    const W = showLarge ? 1100 : 640;
    const H = showLarge ? 300 : 120;
    const padL = 46, padR = 14, padT = 16, padB = 28;

    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i < n; i++) {
      const h = streams.hr[i];
      if (h == null) continue;
      xs.push(streams.time_s[i]);
      ys.push(h);
    }
    if (!ys.length) return () => <div className="opacity-70 text-sm">HR stream nie je k dispozícii.</div>;

    const minY = Math.min(...ys, 120);
    const maxY = Math.max(...ys, HR_MAX);
    const minX = xs[0];
    const maxX = xs[xs.length - 1];

    const sx = (t: number) => {
      const w = W - padL - padR;
      return padL + ((t - minX) / Math.max(1, maxX - minX)) * w;
    };
    const sy = (v: number) => {
      const h = H - padT - padB;
      const t = (v - minY) / Math.max(1, maxY - minY);
      return H - padB - t * h;
    };

    // grid ticks
    const yTicks = 4;
    const yVals = new Array(yTicks + 1).fill(0).map((_, i) => minY + (i * (maxY - minY)) / yTicks);
    const xTicks = 4;
    const xVals = new Array(xTicks + 1).fill(0).map((_, i) => minX + (i * (maxX - minX)) / xTicks);

    // zone bands (Z1..Z5) based on fixed CUTS
    const levels = [minY, CUTS[0], CUTS[1], CUTS[2], CUTS[3], maxY];
    const colors = [COL.z1, COL.z2, COL.z3, COL.z4, COL.z5];
    const bands: JSX.Element[] = [];
    for (let i = 0; i < 5; i++) {
      const yTop = sy(levels[i + 1]);
      const yBot = sy(levels[i]);
      bands.push(
        <rect key={`band-${i}`}
          x={padL}
          width={W - padL - padR}
          y={yTop}
          height={Math.max(0, yBot - yTop)}
          fill={colors[i]}
          opacity={0.08}
        />
      );
    }

    // polyline segmented by zone
    const segs: JSX.Element[] = [];
    for (let i = 1; i < ys.length; i++) {
      const x1 = sx(xs[i - 1]);
      const y1 = sy(ys[i - 1]);
      const x2 = sx(xs[i]);
      const y2 = sy(ys[i]);
      const col = zoneColor((ys[i - 1] + ys[i]) / 2);
      segs.push(
        <line key={`seg-${i}`} x1={x1} y1={y1} x2={x2} y2={y2}
          stroke={col} strokeWidth={showLarge ? 3 : 2} strokeLinecap="round" />
      );
    }

    const Axis = () => (
      <>
        {yVals.map((v, i) => (
          <g key={`gy-${i}`}>
            <line x1={padL} x2={W - padR} y1={sy(v)} y2={sy(v)} stroke={COL.grid} strokeDasharray="4 4" />
            <text x={padL - 8} y={sy(v)} textAnchor="end" dominantBaseline="central" fontSize={showLarge ? 12 : 10} fill="#cbd5e1">
              {Math.round(v)}
            </text>
          </g>
        ))}
        {xVals.map((t, i) => (
          <g key={`gx-${i}`}>
            <line x1={sx(t)} x2={sx(t)} y1={padT} y2={H - padB} stroke={COL.grid} strokeDasharray="4 4" />
            <text x={sx(t)} y={H - padB + 14} textAnchor="middle" fontSize={showLarge ? 12 : 10} fill="#cbd5e1">
              {fmtSecondsHMS(Math.round(t))}
            </text>
          </g>
        ))}
        {/* axis labels – posunuté, aby sa neprekrývali */}
        <text
          x={padL - 28}
          y={(padT + (H - padB)) / 2}
          textAnchor="middle"
          fontSize={showLarge ? 12 : 10}
          fill="#94a3b8"
          transform={`rotate(-90 ${padL - 28} ${(padT + (H - padB)) / 2})`}
        >
          bpm
        </text>
        <text
          x={(padL + (W - padR)) / 2}
          y={H - 4}
          textAnchor="middle"
          fontSize={showLarge ? 12 : 10}
          fill="#94a3b8"
        >
          čas
        </text>
      </>
    );

    const Legend = () => (
      <g transform={`translate(${W - padR - 160}, ${padT})`}>
        {[
          ["Z1", COL.z1],
          ["Z2", COL.z2],
          ["Z3", COL.z3],
          ["Z4", COL.z4],
          ["Z5", COL.z5],
        ].map(([label, col], i) => (
          <g key={label} transform={`translate(0, ${i * 16})`}>
            <rect x={0} y={-8} width={10} height={10} fill={col as string} opacity={0.9} />
            <text x={16} y={0} fontSize={10} fill="#cbd5e1" dominantBaseline="middle">{label}</text>
          </g>
        ))}
      </g>
    );

    return () => (
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="HR priebeh">
        {bands}
        <Axis />
        <defs>
          <clipPath id="hrClip">
            <rect x={padL} y={padT} width={W - padL - padR} height={H - padT - padB} />
          </clipPath>
        </defs>
        <g clipPath="url(#hrClip)">{segs}</g>
        {showLarge && <Legend />}
      </svg>
    );
  }, [streams, showLarge]);

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

<div className="mt-3">
  <div className="flex items-center justify-between">
    <h4 className="font-bold">HR priebeh</h4>
    {hrXs.length > 10 && (
      <button
        className="px-2 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600"
        onClick={() => setShowFull(true)}
      >
        Zväčšiť
      </button>
    )}
  </div>

  {hrXs.length ? (
    <HrChart xs={hrXs} ys={hrYs} height={120} compact />
  ) : (
    <div className="opacity-70 text-sm">HR stream nie je k dispozícii.</div>
  )}
</div>

// fullscreen overlay bez „karty“
{showFull && (
  <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm">
    <div className="absolute inset-0 p-3 md:p-6">
      <div className="bg-gray-800 rounded-lg w-full h-full shadow-lg flex flex-col">
        <div className="flex items-center justify-between p-3">
          <h3 className="text-base md:text-lg font-semibold">HR priebeh (detail)</h3>
          <button onClick={() => setShowFull(false)} className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600">
            Zavrieť
          </button>
        </div>
        {/* mobilu dáme “široký” pomer – 60vh */}
        <div className="px-3 pb-4 grow">
          <div className="w-full" style={{ height: typeof window !== "undefined" && window.innerWidth < 768 ? '60vh' : '420px' }}>
            <HrChart xs={hrXs} ys={hrYs} height={typeof window !== "undefined" && window.innerWidth < 768 ? undefined as any : 420} />
          </div>
        </div>
      </div>
    </div>
  </div>
)}
      {loading && <div>Načítavam detail (laps/splits)…</div>}

      {!!laps.length && (
        <>
          <h4 className="font-bold mt-3">Laps</h4>
          <ul className="list-disc pl-5">
            {laps.map((lap: any, idx: number) => (
              <li key={lap.lap_index ?? idx}>
                Lap {lap.lap_index ?? idx}: {fmtDistance(lap.distance_m)}, {fmtSecondsHMS(lap.moving_time_s)}
              </li>
            ))}
          </ul>
        </>
      )}

      {!!splits.length && (
        <>
          <h4 className="font-bold mt-3">Splits</h4>
          <ul className="list-disc pl-5">
            {splits.map((split: any, idx: number) => (
              <li key={split.split_index ?? idx}>
                Split {split.split_index ?? idx}: {fmtDistance(split.distance_m)}, {fmtSecondsHMS(split.moving_time_s)}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}