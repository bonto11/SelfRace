// src/app/shared/components/session/DetailExternal.tsx
"use client";

import type { ComponentVariant } from "@/app/features/activities/types/activities";
import { safeText } from "@/app/shared/components/session/sessionUtils";
import type { ExternalSession } from "@/app/shared/components/session/SessionCard";
import { useT } from "@/app/shared/i18n/useT";
import {
  SESSION_MINIGRID_BASE,
  SESSION_MINIGRID_2COL,
  SESSION_MINIGRID_3COL,
  SESSION_MINITILE,
  SESSION_MINITILE_STYLE,
  SESSION_MINITILE_LABEL,
  SESSION_MINITILE_VALUE,
} from "@/app/shared/ui/tokens";

type MiniMetric = { label: string; value: string | number | null; };

function valOrDash(v: string | number | null): string {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

function MiniMetricGrid({ metrics, cols = 2 }: { metrics: MiniMetric[], cols?: 2 | 3 }) {
  if (!metrics?.length) return null;
  const colClass = cols === 2 ? SESSION_MINIGRID_2COL : SESSION_MINIGRID_3COL;
  return (
    <div className={[SESSION_MINIGRID_BASE, colClass].join(" ")}>
      {metrics.map((m) => (
        <div key={m.label} className={SESSION_MINITILE} style={SESSION_MINITILE_STYLE}>
          <div className={SESSION_MINITILE_LABEL}>{m.label}</div>
          <div className={SESSION_MINITILE_VALUE}>{valOrDash(m.value)}</div>
        </div>
      ))}
    </div>
  );
}

export default function DetailExternal({ item }: { variant: ComponentVariant; item: ExternalSession; }) {
  const t = useT();
  const kpis = Array.isArray(item.kpis) ? item.kpis : [];

  const metricsFromKpis: MiniMetric[] = kpis.map((k) => ({
    label: k.label,
    value: k.value,
  }));

  const fallbackMetrics: MiniMetric[] = [
    item.time ? { label: t("common.metrics.time"), value: item.time } : null,
    item.durationMin != null
      ? { label: t("sessions.detail.unitMin"), value: `${item.durationMin} min` }
      : null,
  ].filter(Boolean) as MiniMetric[];

  return (
    <div>
      <MiniMetricGrid metrics={metricsFromKpis.length > 0 ? metricsFromKpis : fallbackMetrics} cols={2} />
      {item.notes && (
        <div className="mt-3 text-sm opacity-90">{safeText(item.notes)}</div>
      )}
    </div>
  );
}