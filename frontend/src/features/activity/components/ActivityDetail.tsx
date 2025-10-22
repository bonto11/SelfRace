// src/features/activity/components/ActivityDetail.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { CARD } from "@/shared/ui/classes";
import { THEME } from "@/shared/theme/tokens";
import { useActivityData } from "@/features/activity/data/ActivityDataProvider";
import { fmtSecondsHMS, fmtDistance } from "@/shared/utils/format";

interface Props { activityId: number; }

type StreamsData = { time_s: number[]; hr: (number | null)[]; duration_s: number };

const Z = {
  z1: THEME.chart?.z1 ?? "#93C5FD",
  z2: THEME.chart?.z2 ?? "#34D399",
  z3: THEME.chart?.z3 ?? "#FBBF24",
  z4: THEME.chart?.z4 ?? "#F97316",
  z5: THEME.chart?.z5 ?? "#EF4444",
  grid: THEME.chart?.grid ?? "rgba(255,255,255,.15)",
  line: THEME.chart?.run ?? "#22D3EE",
};

function computeZoneCuts(hrMax?: number | null, minY?: number, maxY?: number) {
  if (hrMax && hrMax > 100) {
    // 50/60/70/80/90 % HRmax
    const c1 = 0.60 * hrMax;
    const c2 = 0.70 * hrMax;
    const c3 = 0.80 * hrMax;
    const c4 = 0.90 * hrMax;
    return [c1, c2, c3, c4];
  }
  // fallback – rozrež aktuálny rozsah na 5 rovnakých pásiem
  const lo = Number.isFinite(minY) ? (minY as number) : 120;
  const hi = Number.isFinite(maxY) ? (maxY as number) : 200;
  const step = (hi - lo) / 5;
  return [lo + step, lo + 2 * step, lo + 3 * step, lo + 4 * step];
}

function pickZoneColor(hr: number, cuts: number[]) {
  if (hr < cuts[0]) return Z.z1;
  if (hr < cuts[1]) return Z.z2;
  if (hr < cuts[2]) return Z.z3;
  if (hr < cuts[3]) return Z.z4;
  return Z.z5;
}

export default function ActivityDetail({ activityId }: Props) {
  const { getSummary, getStreams, getDetail } = useActivityData();
  const summary = getSummary(activityId);

  const [loading, setLoading] = useState(true);
  const [streams, setStreams] = useState<StreamsData>({ time_s: [], hr: [], duration_s: 0 });
  const [laps, setLaps] = useState<any[]>([]);
  const [splits, setSplits] = useState<any[]>([]);
  const [showLarge, setShowLarge] = useState(false);

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

    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const minX = xs[0];
    const maxX = xs[xs.length - 1];

    const cuts = computeZoneCuts(summary.max_heartrate_bpm as number | undefined, minY, maxY);

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

    // zone bands (Z1..Z5)
    const bands = (() => {
      const [c1, c2, c3, c4] = cuts;
      const levels = [minY, c1, c2, c3, c4, maxY];
      const colors = [Z.z1, Z.z2, Z.z3, Z.z4, Z.z5];
      const nodes: JSX.Element[] = [];
      for (let i = 0; i < 5; i++) {
        const yTop = sy(levels[i + 1]);
        const yBot = sy(levels[i]);
        nodes.push(
          <rect
            key={`band-${i}`}
            x={padL}
            width={W - padL - padR}
            y={yTop}
            height={yBot - yTop}
            fill={colors[i]}
            opacity={0.08}
          />
        );
      }
      return nodes;
    })();

    // polyline segmented by zone (small line segments)
    const segs: JSX.Element[] = [];
    for (let i = 1; i < ys.length; i++) {
      const x1 = sx(xs[i - 1]);
      const y1 = sy(ys[i - 1]);
      const x2 = sx(xs[i]);
      const y2 = sy(ys[i]);
      const col = pickZoneColor((ys[i - 1] + ys[i]) / 2, cuts);
      segs.push(
        <line
          key={`seg-${i}`}
          x1={x1} y1={y1} x2={x2} y2={y2}
          stroke={col} strokeWidth={showLarge ? 3 : 2} strokeLinecap="round"
        />
      );
    }

    const Axis = () => (
      <>
        {/* grid + tick labels */}
        {yVals.map((v, i) => (
          <g key={`gy-${i}`}>
            <line x1={padL} x2={W - padR} y1={sy(v)} y2={sy(v)} stroke={Z.grid} strokeDasharray="4 4" />
            <text x={padL - 8} y={sy(v)} textAnchor="end" dominantBaseline="central" fontSize={showLarge ? 12 : 10} fill="#cbd5e1">
              {Math.round(v)}
            </text>
          </g>
        ))}
        {xVals.map((t, i) => (
          <g key={`gx-${i}`}>
            <line x1={sx(t)} x2={sx(t)} y1={padT} y2={H - padB} stroke={Z.grid} strokeDasharray="4 4" />
            <text x={sx(t)} y={H - padB + 14} textAnchor="middle" fontSize={showLarge ? 12 : 10} fill="#cbd5e1">
              {fmtSecondsHMS(Math.round(t))}
            </text>
          </g>
        ))}

        {/* axis labels – posunuté tak, aby sa neprekrývali */}
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

    // legenda zón
    const Legend = () => (
      <g transform={`translate(${W - padR - 160}, ${padT})`}>
        {[
          ["Z1", Z.z1],
          ["Z2", Z.z2],
          ["Z3", Z.z3],
          ["Z4", Z.z4],
          ["Z5", Z.z5],
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
        {/* zone bands */}
        {bands}
        {/* axes + grid */}
        <Axis />
        {/* clipped drawing area */}
        <defs>
          <clipPath id="hrClip">
            <rect x={padL} y={padT} width={W - padL - padR} height={H - padT - padB} />
          </clipPath>
        </defs>
        <g clipPath="url(#hrClip)">{segs}</g>
        {showLarge && <Legend />}
      </svg>
    );
  }, [streams, summary?.max_heartrate_bpm, showLarge]);

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

      {/* HR priebeh */}
      <div className="mt-3">
        <div className="flex items-center justify-between">
          <h4 className="font-bold">HR priebeh</h4>
          <button
            onClick={() => setShowLarge(s => !s)}
            className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600"
          >
            {showLarge ? "Zmenšiť" : "Zväčšiť"}
          </button>
        </div>
        <div className={showLarge ? "mt-2" : "mt-2 max-w-full"}>
          {Chart()}
        </div>
      </div>

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