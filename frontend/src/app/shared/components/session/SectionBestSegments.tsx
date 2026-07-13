// src/app/shared/components/session/ActivityBestSegmentsSection.tsx
"use client";

import { appColors } from "@/app/shared/ui/theme/app_colors";
import type { ActivityEnrichment } from "@/app/features/activities/types/activities_enrichment";

type Props = {
  enrichment: ActivityEnrichment | null;
  t: any;
};

type SegmentDef = {
  key: keyof ActivityEnrichment;
  labelKey: string;
};

const SEGMENT_DEFS: SegmentDef[] = [
  // Beh
  { key: "best_400m_s", labelKey: "sessions.detail.segments.run400m" },
  { key: "best_1k_s", labelKey: "sessions.detail.segments.run1k" },
  { key: "best_5k_s", labelKey: "sessions.detail.segments.run5k" },
  { key: "best_10k_s", labelKey: "sessions.detail.segments.run10k" },
  { key: "best_20k_s", labelKey: "sessions.detail.segments.run20k" },
  { key: "best_half_s", labelKey: "sessions.detail.segments.runHalf" },
  { key: "best_30k_s", labelKey: "sessions.detail.segments.run30k" },
  { key: "best_marathon_s", labelKey: "sessions.detail.segments.runMarathon" },
  { key: "best_50k_s", labelKey: "sessions.detail.segments.run50k" },
  // Plávanie
  { key: "best_swim_100m_s", labelKey: "sessions.detail.segments.swim100m" },
  { key: "best_swim_400m_s", labelKey: "sessions.detail.segments.swim400m" },
  { key: "best_swim_750m_s", labelKey: "sessions.detail.segments.swim750mSprint" },
  { key: "best_swim_1k_s", labelKey: "sessions.detail.segments.swim1k" },
  { key: "best_swim_1500m_s", labelKey: "sessions.detail.segments.swim1500mOlympic" },
  { key: "best_swim_1900m_s", labelKey: "sessions.detail.segments.swim1900mHalfIm" },
  { key: "best_swim_3800m_s", labelKey: "sessions.detail.segments.swim3800mIronman" },
  { key: "best_swim_5k_s", labelKey: "sessions.detail.segments.swim5k" },
  // Bicykel
  { key: "best_ride_10k_s", labelKey: "sessions.detail.segments.ride10k" },
  { key: "best_ride_20k_s", labelKey: "sessions.detail.segments.ride20k" },
  { key: "best_ride_40k_s", labelKey: "sessions.detail.segments.ride40k" },
  { key: "best_ride_50k_s", labelKey: "sessions.detail.segments.ride50k" },
  { key: "best_ride_90k_s", labelKey: "sessions.detail.segments.ride90k" },
  { key: "best_ride_100k_s", labelKey: "sessions.detail.segments.ride100k" },
  { key: "best_ride_100mi_s", labelKey: "sessions.detail.segments.ride100mi" },
  { key: "best_ride_180k_s", labelKey: "sessions.detail.segments.ride180kIronman" },
];

function fmtTime(seconds: number): string {
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(h > 0 ? 2 : 1, "0");
  const ss = String(sec).padStart(2, "0");
  if (h > 0) return `${h}:${mm}:${ss}`;
  return `${mm}:${ss}`;
}

export function hasAnyBestSegment(enrichment: ActivityEnrichment | null): boolean {
  if (!enrichment) return false;
  return SEGMENT_DEFS.some((def) => typeof enrichment[def.key] === "number");
}

const TILE_CLASS =
  "rounded-xl border px-3 py-2 flex flex-col justify-center shadow-sm";
const TILE_STYLE = {
  background: appColors.backgroundAlt,
  borderColor: appColors.surfaceCardBorder,
};

export function SectionBestSegments({ enrichment, t }: Props) {
  const items = SEGMENT_DEFS
    .map((def) => {
      const raw = enrichment?.[def.key];
      const value = typeof raw === "number" ? raw : null;
      if (value == null) return null;
      return { label: t(def.labelKey as any), value: fmtTime(value) };
    })
    .filter(Boolean) as { label: string; value: string }[];

  if (!items.length) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {items.map((it) => (
        <div key={it.label} className={TILE_CLASS} style={TILE_STYLE}>
          <div className="text-[10px] uppercase tracking-wider font-bold opacity-50 mb-0.5">
            {it.label}
          </div>
          <div className="text-[15px] font-semibold tabular-nums text-white/90">
            {it.value}
          </div>
        </div>
      ))}
    </div>
  );
}