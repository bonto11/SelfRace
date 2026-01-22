"use client";

import { useEffect, useMemo, useState } from "react";
import { useActivityData } from "@/app/shared/components/dataProviders/ActivityDataProvider";
import { fmtSecondsHMS } from "@/app/shared/utils/time";
import { CHART_SPARK } from "@/app/shared/theme/uiTokens";

type Props = { activityId: number; height?: number };

export default function MiniHrSpark({ activityId, height = 64 }: Props) {
  const { getStreams } = useActivityData();
  const [xs, setXs] = useState<number[]>([]);
  const [ys, setYs] = useState<(number | null)[]>([]);
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
    return () => {
      alive = false;
    };
  }, [activityId, getStreams]);

  const [minHR, maxHR] = useMemo(() => {
    const vals = ys.filter((v): v is number => Number.isFinite(v as number));
    if (!vals.length) return [0, 0];
    return [Math.min(...vals), Math.max(...vals)];
  }, [ys]);

  const path = useMemo(() => {
    if (!xs.length || !ys.length || maxHR <= minHR) return "";
    const w = CHART_SPARK.width;
    const h = height;
    const n = Math.min(xs.length, ys.length);
    const x0 = xs[0];
    const x1 = xs[n - 1];
    const span = Math.max(1, x1 - x0);
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
    return (
      <div className={CHART_SPARK.emptyTextClass}>
        HR stream nie je k dispozícii.
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${CHART_SPARK.width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="HR sparkline"
      >
        <defs>
          <linearGradient id="hrLine" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART_SPARK.gradientTop} />
            <stop offset="100%" stopColor={CHART_SPARK.gradientBottom} />
          </linearGradient>
        </defs>

        {/* baseline */}
        <rect
          x="0"
          y={height - 1}
          width={CHART_SPARK.width}
          height="1"
          fill={CHART_SPARK.baseline}
        />

        {/* HR path */}
        <path
          d={path}
          fill="none"
          stroke="url(#hrLine)"
          strokeWidth={CHART_SPARK.lineWidth}
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <div className={CHART_SPARK.infoTextClass}>
        <div>
          HR: {minHR}–{maxHR} bpm
        </div>
        <div>Čas: {fmtSecondsHMS(dur)}</div>
      </div>
    </div>
  );
}
