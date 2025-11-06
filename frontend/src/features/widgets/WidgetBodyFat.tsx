"use client";

import * as React from "react";
import WidgetCard from "@/shared/components/ui/WidgetCard";
import LoadingSpinner from "@/shared/components/ui/LoadingSpinner";
import Pill from "@/shared/components/ui/Pill";
import { API_URL } from "@/shared/config";
import { useUserId } from "@/shared/hooks/useUserId";
import { getBodyFatBands } from "@/shared/utils/bands";
import { THEME } from "@/shared/theme/tokens";
import { NO_X_OVERFLOW } from "@/shared/ui/classes";

type Props = { onOpen?: () => void; onOpenDetail?: () => void };
type StaticProfile = { sex: "M" | "F" };

type MetricRowBE = { measured_at: string; value_num: number | null };
type MetricsRowFE = { updated_at: string; body_fat_pct: number | null };

function fmtDate(d?: string | null) {
  return d ? new Date(d).toLocaleDateString("sk-SK") : "—";
}

function colorForLevel(labelRaw: string) {
  const l = (labelRaw || "").toLowerCase();
  if (l.includes("athlete"))   return (THEME as any)?.chart?.athletes ?? "#10B981";
  if (l.includes("fitness"))   return (THEME as any)?.chart?.fitness  ?? "#14B8A6";
  if (l.includes("average"))   return (THEME as any)?.chart?.average  ?? "#F59E0B";
  if (l.includes("essential")) return (THEME as any)?.chart?.essential?? "#22D3EE";
  if (l.includes("obese"))     return (THEME as any)?.chart?.obese    ?? "#F43F5E";
  return (THEME as any)?.chart?.neutral ?? "#64748B";
}

function classifyBodyFat(sex: "M" | "F", pct?: number | null) {
  if (pct == null || !Number.isFinite(pct)) return null;
  const bands = getBodyFatBands(sex);
  const hit = bands.find(b => (b.min == null || pct >= b.min) && (b.max == null || pct <= b.max));
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

        // static
        try {
          const r0 = await fetch(`${API_URL}/profile/static/${userId}`, { cache: "no-store" });
          const js0 = await r0.json().catch(() => ({}));
          if (alive && js0?.success) setStat(js0.data as StaticProfile);
        } catch {}

        // posledná hodnota BF
        const r1 = await fetch(`${API_URL}/profile/metrics/history/${userId}?metric=body_fat_pct`, { cache: "no-store" });
        const js1 = await r1.json().catch(() => ({}));
        const rowsBE: MetricRowBE[] = Array.isArray(js1?.data) ? js1.data : [];
        const lastBE = rowsBE.slice(-1)[0];
        const last: MetricsRowFE | null = lastBE
          ? { updated_at: lastBE.measured_at, body_fat_pct: (typeof lastBE.value_num === "number" ? lastBE.value_num : null) }
          : null;

        if (alive) setLatest(last);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
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