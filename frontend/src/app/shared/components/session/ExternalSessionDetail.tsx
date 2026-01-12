"use client";

import type { ComponentVariant } from "@/app/features/activities/types/activities";
import { safeText } from "@/app/shared/components/session/sessionUtils";
import type { ExternalSession } from "@/app/shared/components/session/SessionCard";

/** rovnaký mini grid ako pri pláne / aktivitách */

type MiniMetric = {
  label: string;
  value: string | number | null;
};

type MiniMetricGridProps = {
  metrics: MiniMetric[];
  cols?: 2 | 3;
};

function valOrDash(v: string | number | null): string {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

function MiniMetricGrid({ metrics, cols = 2 }: MiniMetricGridProps) {
  if (!metrics || metrics.length === 0) return null;

  const colClass =
    cols === 2
      ? "grid-cols-2 sm:grid-cols-4"
      : "grid-cols-3 sm:grid-cols-6";

  return (
    <div className={`mt-3 grid ${colClass} gap-2`}>
      {metrics.map((m) => (
        <div
          key={m.label}
          className="rounded-lg border border-white/5 bg-white/5 px-2.5 py-1.5"
        >
          <div className="text-[10px] opacity-70 leading-tight">
            {m.label}
          </div>
          <div className="text-sm font-semibold tabular-nums leading-tight">
            {valOrDash(m.value as any)}
          </div>
        </div>
      ))}
    </div>
  );
}

type Props = {
  variant: ComponentVariant;
  item: ExternalSession;
};

export default function ExternalSessionDetail({ item }: Props) {
  const kpis = Array.isArray(item.kpis) ? item.kpis : [];

  const metricsFromKpis: MiniMetric[] = kpis.map((k) => ({
    label: k.label,
    value: k.value,
  }));

  const fallbackMetrics: MiniMetric[] = [
    item.time ? { label: "Time", value: item.time } : null,
    item.durationMin != null
      ? { label: "Duration", value: `${item.durationMin} min` }
      : null,
  ].filter(Boolean) as MiniMetric[];

  return (
    <div>
      {metricsFromKpis.length > 0 && (
        <MiniMetricGrid metrics={metricsFromKpis} cols={2} />
      )}

      {metricsFromKpis.length === 0 && fallbackMetrics.length > 0 && (
        <MiniMetricGrid metrics={fallbackMetrics} cols={2} />
      )}

      {item.notes && (
        <div className="mt-3 text-sm opacity-90">{safeText(item.notes)}</div>
      )}
    </div>
  );
}