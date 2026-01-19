"use client";

import * as React from "react";
import WidgetCard from "@/app/shared/components/ui/WidgetCard";
import LoadingSpinner from "@/app/shared/components/ui/LoadingSpinner";
import Pill from "@/app/shared/components/ui/Pill";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { getBodyFatBands } from "@/app/shared/utils/bands";
import { THEME } from "@/app/shared/theme/tokens";
import { NO_X_OVERFLOW } from "@/app/shared/ui/uiTokens";
import { fmtDate } from "@/app/shared/utils/time";

import { apiGetStaticProfile } from "@/app/features/profile/api/static";
import { apiGetMetricHistory } from "@/app/features/profile/api/metrics";
import type {
  StaticProfile,
  MetricHistoryRow,
} from "@/app/features/profile/types/profile";

type Props = { onOpen?: () => void; onOpenDetail?: () => void };

type MetricsRowFE = { updated_at: string; body_fat_pct: number | null };

function colorForLevel(labelRaw: string) {
  const l = (labelRaw || "").toLowerCase();
  if (l.includes("athlete"))
    return (THEME as any)?.chart?.athletes ?? "#10B981";
  if (l.includes("fitness")) return (THEME as any)?.chart?.fitness ?? "#14B8A6";
  if (l.includes("average")) return (THEME as any)?.chart?.average ?? "#F59E0B";
  if (l.includes("essential"))
    return (THEME as any)?.chart?.essential ?? "#22D3EE";
  if (l.includes("obese")) return (THEME as any)?.chart?.obese ?? "#F43F5E";
  return (THEME as any)?.chart?.neutral ?? "#64748B";
}

function classifyBodyFat(sex: "M" | "F", pct?: number | null) {
  if (pct == null || !Number.isFinite(pct)) return null;
  const bands = getBodyFatBands(sex);
  const hit = bands.find(
    (b) => (b.min == null || pct >= b.min) && (b.max == null || pct <= b.max)
  );
  if (!hit) return null;
  return { label: hit.label.trim(), color: colorForLevel(hit.label) };
}

export default function WidgetBodyFat({ onOpen, onOpenDetail }: Props) {
  const handleOpen = onOpen ?? onOpenDetail;
  const { userId } = useUserId();

  const [loading, setLoading] = React.useState(true);
  const [stat, setStat] = React.useState<StaticProfile | null>(null);
  const [latest, setLatest] = React.useState<MetricsRowFE | null>(null);

  React.useEffect(() => {
    if (!userId) return;

    let alive = true;

    (async () => {
      try {
        setLoading(true);

        const [staticProfile, history] = await Promise.all([
          apiGetStaticProfile(userId),
          apiGetMetricHistory(userId, "body_fat_pct"),
        ]);

        if (!alive) return;

        if (staticProfile) {
          setStat(staticProfile);
        } else {
          setStat(null);
        }

        const rowsBE: MetricHistoryRow[] = Array.isArray(history)
          ? history
          : [];
        const lastBE = rowsBE.length ? rowsBE[rowsBE.length - 1] : undefined;

        const last: MetricsRowFE | null = lastBE
          ? {
              updated_at: lastBE.measured_at,
              body_fat_pct:
                typeof lastBE.value_num === "number" ? lastBE.value_num : null,
            }
          : null;

        setLatest(last);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [userId]);

  const pct = latest?.body_fat_pct ?? null;
  const level = classifyBodyFat(stat?.sex ?? "M", pct);

  const accentHex =
    level?.color ??
    (THEME as any)?.accent?.primary ??
    (THEME as any)?.chart?.neutral ??
    "#64748B";

  return (
    <WidgetCard
      title="Body Fat %"
      onOpen={handleOpen}
      interactive={!!handleOpen}
      accent={accentHex}
      minH={168}
      innerClassName={NO_X_OVERFLOW}
    >
      {loading ? (
        <div className="grid place-items-center py-6">
          <LoadingSpinner size="widget" />
        </div>
      ) : (
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[11px] uppercase opacity-70">
              merané: {fmtDate(latest?.updated_at)}
            </div>
            <div className="mt-1 flex items-end gap-2">
              <div className="text-4xl font-extrabold tabular-nums">
                {pct != null ? pct.toFixed(1) : "—"}
                <span className="text-base align-top ml-1">%</span>
              </div>
              {level ? (
                <Pill label={level.label} color={level.color} />
              ) : (
                <span className="text-xs opacity-60">—</span>
              )}
            </div>
          </div>
        </div>
      )}
    </WidgetCard>
  );
}
