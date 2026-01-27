// src/app/shared/components/session/MetricGrid.tsx
"use client";

import { ReactNode } from "react";
import { safeText } from "./sessionUtils";
import {
  SESSION_METRICGRID,
  SESSION_METRICGRID_COLS_2,
  SESSION_METRICGRID_COLS_3,
  SESSION_METRICGRID_COLS_4,
  SESSION_METRICTILE,
  SESSION_METRICTILE_STYLE,
  SESSION_METRICTILE_LABEL,
  SESSION_METRICTILE_VALUE,
} from "@/app/shared/ui/tokens";

export type Metric = { label: ReactNode; value: ReactNode };

export function MetricGrid({
  metrics,
  cols = 4,
}: {
  metrics: Metric[];
  cols?: 2 | 3 | 4;
}) {
  const colCls =
    cols === 2
      ? SESSION_METRICGRID_COLS_2
      : cols === 3
      ? SESSION_METRICGRID_COLS_3
      : SESSION_METRICGRID_COLS_4;

  return (
    <div className={[SESSION_METRICGRID, colCls].join(" ")}>
      {metrics.map((m, idx) => (
        <MetricTile
          key={`${String(m.label)}-${idx}`}
          label={m.label}
          value={m.value}
        />
      ))}
    </div>
  );
}

export function MetricTile({ label, value }: Metric) {
  return (
    <div className={SESSION_METRICTILE} style={SESSION_METRICTILE_STYLE}>
      <div className={SESSION_METRICTILE_LABEL}>{safeText(label)}</div>
      <div className={SESSION_METRICTILE_VALUE}>
        {value != null ? safeText(value) : "—"}
      </div>
    </div>
  );
}