// src/features/activity/components/MiniHrSpark.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useActivityData } from "@/features/activity/data/ActivityDataProvider";
import { fmtSecondsHMS } from "@/shared/utils/format";

type Props = { activityId: number; height?: number };

export default function MiniHrSpark({ activityId, height = 64 }: Props) {
  const { getStreams } = useActivityData();
  const [xs, setXs] = useState<number[]>([]);
  const [ys, setYs] = useState<(number|null)[]>([]);
  const [dur, setDur] = useState<number>(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      const s = await getStreams(activityId);
      if (!alive) return;
      setXs(s.time_s || []);
      setYs(s.hr || []);
      setDur(s.duration_s || 0);
    })();
    return () => { alive = false; };
  }, [activityId, getStreams]);

  const [minHR, maxHR] = useMemo(() => {
    const vals = ys.filter((v): v is number => Number.isFinite(v as number));
    if (!vals.length) return [0, 0];
    const lo = Math.min(...vals), hi = Math.max(...vals);
    return [lo, hi];
  }, [ys]);

  const path = useMemo(() => {
    if (!xs.length || !ys.length || maxHR <= minHR) return "";
    const w = 300; // kreslíme do šírky 300, potom natiahneme viewBox
    const h = height;
    const n = Math.min(xs.length, ys.length);
    const x0 = xs[0], x1 = xs[n-1], span = Math.max(1, x1 - x0);
    const sx = (t: number) => ((t - x0) / span) * w;
    const sy = (hr: number) => {
      const p = (hr - minHR) / (maxHR - minHR);
      return h - p * h; // invert Y
    };

    let d = "";
    for (let i = 0; i < n; i++) {
      const hr = ys[i];
      if (hr == null) continue;
      const x = sx(xs[i]);
      const y = sy(hr);
      d += (d ? " L " : "M ") + `${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    return d;
  }, [xs, ys, minHR, maxHR, height]);

  if (!xs.length || !ys.length) {
    return <div className="text-xs opacity-70">HR stream nie je k dispozícii.</div>;
  }

  return (
    <div className="flex items-center gap-3">
      <svg width="100%" height={height} viewBox={`0 0 300 ${height}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="hrLine" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="#ef4444" />
          </linearGradient>
        </defs>
        {/* baseline */}
        <rect x="0" y={height-1} width="300" height="1" fill="rgba(255,255,255,0.1)" />
        {/* HR path */}
        <path d={path} fill="none" stroke="url(#hrLine)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="text-xs opacity-75 whitespace-nowrap">
        <div>HR: {minHR}–{maxHR} bpm</div>
        <div>Čas: {fmtSecondsHMS(dur)}</div>
      </div>
    </div>
  );
}