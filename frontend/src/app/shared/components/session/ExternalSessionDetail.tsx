"use client";

import { ComponentVariant } from "@/app/features/activities/types/activities";
import { MetricGrid } from "@/app/shared/components/session/MetricGrid";
import { safeText } from "@/app/shared/components/session/sessionUtils";

import type { ExternalSession } from "@/app/shared/components/session/SessionCard";

type Props = {
  variant: ComponentVariant;
  item: ExternalSession;
};

export default function ExternalSessionDetail({ item }: Props) {
  const kpis = Array.isArray(item.kpis) ? item.kpis : [];

  return (
    <div>
      {/* KPIs (ak prídu zhora) */}
      {kpis.length > 0 && (
        <MetricGrid
          metrics={kpis.map((k) => ({
            label: k.label,
            value: k.value,
          }))}
          cols={2}
        />
      )}

      {/* fallback - time + duration */}
      {kpis.length === 0 && (
        <MetricGrid
          cols={2}
          metrics={[
            item.time ? { label: "TIME", value: item.time } : null,
            item.durationMin != null
              ? { label: "DURATION", value: `${item.durationMin} min` }
              : null,
          ].filter(Boolean) as any}
        />
      )}

      {item.notes && (
        <div className="mt-3 text-sm opacity-90">{safeText(item.notes)}</div>
      )}
    </div>
  );
}