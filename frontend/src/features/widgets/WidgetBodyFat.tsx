// src/features/widgets/WidgetBodyFat.tsx
"use client";

import * as React from "react";
import WidgetCard from "@/shared/components/ui/WidgetCard";
import LoadingSpinner from "@/shared/components/ui/LoadingSpinner";
import { API_URL } from "@/shared/config";
import { useUserId } from "@/shared/hooks/useUserId";
import { getBodyFatBands } from "@/shared/utils/bands";
import { THEME } from "@/shared/theme/tokens";

type Props = { onOpen?: () => void; onOpenDetail?: () => void };
type MetricsRow = { updated_at: string; body_fat_pct: number | null };
type StaticProfile = { sex: "M" | "F" };

function fmtDate(d?: string | null) {
  return d ? new Date(d).toLocaleDateString("sk-SK") : "—";
}

// normalizácia labelov pásiem na jednotné kategórie
function normalizeLevel(labelRaw: string) {
  const l = (labelRaw || "").trim().toLowerCase();
  if (l.includes("athlete") || l.includes("excellent")) return "excellent";
  if (l.includes("superior")) return "superior";
  if (l.includes("good")) return "good";
  if (l.includes("average") || l.includes("fair")) return "fair";
  if (l.includes("poor")) return "poor";
  return "neutral";
}

// farba z THEME.chart podľa kategórie (všetko HEX)
function colorForLevel(labelRaw: string) {
  const k = normalizeLevel(labelRaw);
  switch (k) {
    case "excellent":
      return THEME.chart.excellent;
    case "superior":
      return THEME.chart.superior;
    case "good":
      return THEME.chart.good;
    case "fair":
      return THEME.chart.fair;
    case "poor":
      return THEME.chart.poor;
    default:
      return THEME.chart.neutral;
  }
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

function Pill({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{
        background: `${color}1A`, // ~10 % alpha
        border: `1px solid ${color}66`,
        color,
      }}
    >
      {label}
    </span>
  );
}

export default function WidgetBodyFat({ onOpen, onOpenDetail }: Props) {
  const handleOpen = onOpen ?? onOpenDetail;
  const { userId } = useUserId();

  const [loading, setLoading] = React.useState(true);
  const [stat, setStat] = React.useState<StaticProfile | null>(null);
  const [latest, setLatest] = React.useState<MetricsRow | null>(null);

  React.useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      try {
        setLoading(true);

        // pohlavie (kvôli pásmam)
        try {
          const r0 = await fetch(`${API_URL}/profile/static/${userId}`, {
            cache: "no-store",
          });
          const js0 = await r0.json().catch(() => ({}));
          if (alive && js0?.success) setStat(js0.data as StaticProfile);
        } catch {}

        // posledná známa BF hodnota
        const r1 = await fetch(
          `${API_URL}/profile/metrics/history/${userId}`,
          { cache: "no-store" }
        );
        const js1 = await r1.json().catch(() => ({}));
        const rows: MetricsRow[] = Array.isArray(js1?.data) ? js1.data : [];
        const last =
          rows.filter((r) => r.body_fat_pct != null).slice(-1)[0] ?? null;
        if (alive) setLatest(last);
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
  const accentHex = level?.color ?? THEME.chart.neutral;

  return (
    <WidgetCard
      title="Body Fat %"
      onOpen={handleOpen}
      interactive={!!handleOpen}
      accent={accentHex} // čistý HEX – rovnaký ako v trendoch
      minH={168}
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