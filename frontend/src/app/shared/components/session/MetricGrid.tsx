import { ReactNode } from "react";
import { SURFACE_INLINE } from "@/app/shared/ui/tokens";
import { safeText } from "./sessionUtils";

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
      ? "sm:grid-cols-2"
      : cols === 3
      ? "sm:grid-cols-3"
      : "sm:grid-cols-4";

  return (
    <div className={`mt-1 grid grid-cols-1 ${colCls} gap-3`}>
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
    <div className={[SURFACE_INLINE, "px-3 py-2"].join(" ")}>
      <div className="text-[10px] opacity-70">{safeText(label)}</div>
      <div className="text-xl font-semibold tabular-nums truncate">
        {value != null ? safeText(value) : "—"}
      </div>
    </div>
  );
}
