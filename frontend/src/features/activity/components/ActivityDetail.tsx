// src/features/activity/components/ActivityDetail.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { CARD } from "@/shared/ui/classes";
import { THEME } from "@/shared/theme/tokens";
import { useActivityData } from "@/features/activity/data/ActivityDataProvider";
import { fmtSecondsHMS, fmtDistance } from "@/shared/utils/format";

interface Props {
  activityId: number;
}

export default function ActivityDetail({ activityId }: Props) {
  const { getSummary, getDetail, getStreams } = useActivityData();

  const [loading, setLoading] = useState(true);
  const [laps, setLaps] = useState<any[]>([]);
  const [splits, setSplits] = useState<any[]>([]);
  const [hrXs, setHrXs] = useState<number[]>([]);
  const [hrYs, setHrYs] = useState<(number | null)[]>([]);
  const [hrDurS, setHrDurS] = useState<number>(0);

  const summary = getSummary(activityId);

  // fetch laps/splits + HR streams
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const [extra, streams] = await Promise.all([
          getDetail(activityId),
          getStreams(activityId),
        ]);
        if (!alive) return;
        setLaps(extra?.laps ?? []);
        setSplits(extra?.splits ?? []);
        setHrXs(streams?.time_s ?? []);
        setHrYs(streams?.hr ?? []);
        setHrDurS(streams?.duration_s ?? 0);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [activityId, getDetail, getStreams]);

  if (!summary) return <div>❌ Aktivita sa nenašla v 90-d range cache.</div>;

  const distTxt = fmtDistance(summary.distance_m ?? null);
  const timeTxt =
    summary.moving_time_s != null ? fmtSecondsHMS(summary.moving_time_s) : "—";

  // --- HR sparkline (SVG) ---
  const hrSvg = useMemo(() => {
    const n = Math.min(hrXs.length, hrYs.length);
    if (!n) return null;

    const W = 640;
    const H = 120;
    const pad = 8;

    // z HR vyhoď null hodnoty – nakreslíme len tam, kde máme čísla
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i < n; i++) {
      const v = hrYs[i];
      if (Number.isFinite(v)) {
        xs.push(hrXs[i]);
        ys.push(v as number);
      }
    }
    if (!ys.length) return null;

    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    // ak nemáme časovú os, rozlož body rovnomerne
    const hasTime = xs.some((t) => t > 0);
    const dx = hasTime
      ? (W - 2 * pad) / Math.max(1, (xs[xs.length - 1] || hrDurS || 1))
      : (W - 2 * pad) / Math.max(1, ys.length - 1);

    const xAt = (i: number) =>
      hasTime ? pad + xs[i] * dx : pad + i * dx;

    const scaleY = (v: number) => {
      if (maxY === minY) return H / 2;
      const t = (v - minY) / (maxY - minY);
      return H - pad - t * (H - 2 * pad);
    };

    let d = `M ${xAt(0)} ${scaleY(ys[0])}`;
    for (let i = 1; i < ys.length; i++) d += ` L ${xAt(i)} ${scaleY(ys[i])}`;

    return (
      <svg
        width="100%"
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="HR priebeh"
      >
        <rect x="0" y="0" width={W} height={H} fill="transparent" />
        <path d={d} fill="none" stroke={THEME.chart.run} strokeWidth={2} />
        {/* avg HR (dotted baseline), ak je k dispozícii */}
        {Number.isFinite(summary.average_heartrate_bpm) && (
          <line
            x1={pad}
            x2={W - pad}
            y1={scaleY(summary.average_heartrate_bpm as number)}
            y2={scaleY(summary.average_heartrate_bpm as number)}
            stroke={THEME.chart.grid}
            strokeDasharray="4 4"
          />
        )}
      </svg>
    );
  }, [hrXs, hrYs, hrDurS, summary?.average_heartrate_bpm]);

  return (
    <div className={`${CARD} space-y-2`}>
      <h3 className="text-lg font-bold">{summary.name}</h3>

      <p>
        <strong>Date:</strong>{" "}
        {new Date(summary.date).toLocaleString(THEME.i18n.dateLocale, {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </p>

      <p>
        <strong>Distance:</strong> {distTxt}
      </p>
      <p>
        <strong>Time:</strong> {timeTxt}
      </p>
      <p>
        <strong>Avg HR:</strong> {summary.average_heartrate_bpm ?? "—"}
      </p>
      <p>
        <strong>Max HR:</strong> {summary.max_heartrate_bpm ?? "—"}
      </p>

      {loading && <div>Načítavam detail (laps/splits/HR)…</div>}

      {/* HR priebeh */}
      <div className="mt-3">
        <h4 className="font-bold">HR priebeh</h4>
        {hrSvg ? (
          hrSvg
        ) : (
          <div className="opacity-70 text-sm">HR stream nie je k dispozícii.</div>
        )}
      </div>

      {!loading && !!laps.length && (
        <>
          <h4 className="font-bold mt-3">Laps</h4>
          <ul className="list-disc pl-5">
            {laps.map((lap, idx) => (
              <li key={lap.lap_index ?? idx}>
                Lap {lap.lap_index ?? idx}: {fmtDistance(lap.distance_m)},{" "}
                {fmtSecondsHMS(Number(lap.moving_time_s ?? 0))}
              </li>
            ))}
          </ul>
        </>
      )}

      {!loading && !!splits.length && (
        <>
          <h4 className="font-bold mt-3">Splits</h4>
          <ul className="list-disc pl-5">
            {splits.map((split, idx) => (
              <li key={split.split_index ?? idx}>
                Split {split.split_index ?? idx}: {fmtDistance(split.distance_m)},{" "}
                {fmtSecondsHMS(Number(split.moving_time_s ?? 0))}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}