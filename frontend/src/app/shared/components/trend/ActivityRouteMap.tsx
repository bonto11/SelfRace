"use client";

import { useMemo, useState } from "react";

import { CHART_HR, FLUSH_DETAIL_PB, SCROLL_X } from "@/app/shared/ui/tokens";
import DisclosureToggle from "@/app/shared/ui/components/DisclosureToggle";

type Point = { lat: number; lng: number };

type ActivityRouteMapProps = {
  points: Point[];
};

export function ActivityRouteMap({ points }: ActivityRouteMapProps) {
  const [open, setOpen] = useState(false);

  // ak nemáme trasu, nič nekresli
  if (!points || points.length < 2) {
    return null;
  }

  const SvgRoute = useMemo(() => {
    const W = 1000;
    const H = 420;
    const pad = 24;

    let minLat = points[0].lat;
    let maxLat = points[0].lat;
    let minLng = points[0].lng;
    let maxLng = points[0].lng;

    for (const p of points) {
      if (p.lat < minLat) minLat = p.lat;
      if (p.lat > maxLat) maxLat = p.lat;
      if (p.lng < minLng) minLng = p.lng;
      if (p.lng > maxLng) maxLng = p.lng;
    }

    // ochrana proti deleniu nulou
    const dLat = Math.max(1e-6, maxLat - minLat);
    const dLng = Math.max(1e-6, maxLng - minLng);

    // zachovaj pomer strán: trasa vyplní box čo najviac, ale nedeformuje sa
    const innerW = W - 2 * pad;
    const innerH = H - 2 * pad;
    const scale = Math.min(innerW / dLng, innerH / dLat);

    const offsetX = pad + (innerW - scale * dLng) / 2 - scale * minLng;
    const offsetY = pad + (innerH - scale * dLat) / 2 + scale * maxLat; // lat rastie hore, svg dole

    const project = (p: Point) => {
      const x = scale * p.lng + offsetX;
      const y = -scale * p.lat + offsetY;
      return { x, y };
    };

    const projected = points.map(project);

    let d = "";
    projected.forEach((p, i) => {
      d += `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)} `;
    });

    const start = projected[0];
    const end = projected[projected.length - 1];

    const bg = "#020617"; // tailwind slate-950

    return () => (
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} role="img">
        {/* podklad – jemný gradient / “sklenený” look */}
        <defs>
          <linearGradient id="route-bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={bg} stopOpacity={0.95} />
            <stop offset="100%" stopColor={bg} stopOpacity={0.85} />
          </linearGradient>
          <linearGradient id="route-line" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={CHART_HR.colors.z2} />
            <stop offset="45%" stopColor={CHART_HR.colors.z3} />
            <stop offset="100%" stopColor={CHART_HR.colors.z4} />
          </linearGradient>
        </defs>

        <rect
          x={0}
          y={0}
          width={W}
          height={H}
          fill="url(#route-bg)"
          rx={18}
          ry={18}
        />

        {/* jemná mriežka */}
        <g stroke="rgba(148,163,184,0.35)" strokeWidth={0.5}>
          {Array.from({ length: 6 }).map((_, i) => {
            const x = pad + (innerW / 5) * i;
            return (
              <line
                key={`vx-${i}`}
                x1={x}
                x2={x}
                y1={pad}
                y2={H - pad}
                strokeDasharray="4 4"
              />
            );
          })}
          {Array.from({ length: 4 }).map((_, i) => {
            const y = pad + (innerH / 3) * i;
            return (
              <line
                key={`hy-${i}`}
                x1={pad}
                x2={W - pad}
                y1={y}
                y2={y}
                strokeDasharray="4 4"
              />
            );
          })}
        </g>

        {/* hlavná trasa */}
        <path
          d={d.trim()}
          fill="none"
          stroke="url(#route-line)"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* začiatočný bod */}
        <circle
          cx={start.x}
          cy={start.y}
          r={5}
          fill={CHART_HR.colors.z2}
          stroke="white"
          strokeWidth={1}
        />

        {/* koncový bod */}
        <circle
          cx={end.x}
          cy={end.y}
          r={5}
          fill={CHART_HR.colors.z4}
          stroke="white"
          strokeWidth={1}
        />
      </svg>
    );
  }, [points]);

  return (
    <div className="mt-3">
      <div className={FLUSH_DETAIL_PB}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-sm font-semibold">Mapa trasy</span>
            <span className="text-[11px] opacity-70">
              Projekcia GPS bodov (lat/lng) – prehľad tvaru trasy
            </span>
          </div>
          <DisclosureToggle
            open={open}
            onToggle={() => setOpen((v) => !v)}
            labelWhenOpen="Skryť mapu trasy"
            labelWhenClosed="Zobraziť mapu trasy"
          />
        </div>

        {open && (
          <div className="mt-3">
            <div className={SCROLL_X}>
              <div className="min-w-[720px]">
                <SvgRoute />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
