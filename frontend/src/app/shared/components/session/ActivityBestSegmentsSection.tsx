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
  { key: "best_1k_s", labelKey: "sessions.detail.segments.1k" },
  { key: "best_5k_s", labelKey: "sessions.detail.segments.5k" },
  { key: "best_10k_s", labelKey: "sessions.detail.segments.10k" },
  { key: "best_half_s", labelKey: "sessions.detail.segments.half" },
  { key: "best_marathon_s", labelKey: "sessions.detail.segments.marathon" },
  { key: "best_50k_s", labelKey: "sessions.detail.segments.50k" },
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
  if (!enrichment) {
    console.log("[BestSegments] hasAnyBestSegment: enrichment is null/undefined");
    return false;
  }
  const result = SEGMENT_DEFS.some((def) => typeof enrichment[def.key] === "number");
  console.log("[BestSegments] hasAnyBestSegment check", {
    enrichment,
    segmentValues: SEGMENT_DEFS.map((def) => ({ key: def.key, value: enrichment[def.key], type: typeof enrichment[def.key] })),
    result,
  });
  return result;
}

const TILE_CLASS =
  "rounded-xl border px-3 py-2 flex flex-col justify-center shadow-sm";
const TILE_STYLE = {
  background: appColors.backgroundAlt,
  borderColor: appColors.surfaceCardBorder,
};

export function ActivityBestSegmentsSection({ enrichment, t }: Props) {
  console.log("[BestSegments] ActivityBestSegmentsSection render", { enrichment });

  const items = SEGMENT_DEFS
    .map((def) => {
      const raw = enrichment?.[def.key];
      const value = typeof raw === "number" ? raw : null;
      if (value == null) return null;
      return { label: t(def.labelKey as any), value: fmtTime(value) };
    })
    .filter(Boolean) as { label: string; value: string }[];

  console.log("[BestSegments] computed items", items);

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