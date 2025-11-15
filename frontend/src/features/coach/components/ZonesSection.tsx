"use client";

import { SECTION, SURFACE_INLINE } from "@/shared/ui/classes";
import { InfoPopover } from "./InfoPopover";

type Props = {
  zones: any | undefined;
  thresholds: any | undefined;
};

export function ZonesSection({ zones, thresholds }: Props) {
  const hasZones = !!zones;
  const hasThresholds = !!thresholds;

  return (
    <section className={SECTION}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium opacity-90">
          Heart-rate zones & thresholds
        </div>
        <InfoPopover text="Zóny sú načítané z posledného testu / nastavení. Neskôr pribudne samostatný editor." />
      </div>

      {!hasZones && !hasThresholds && (
        <div
          className={[SURFACE_INLINE, "px-3 py-2 text-xs opacity-70"].join(" ")}
        >
          No zones / thresholds found – planner will use internal defaults.
        </div>
      )}

      {hasZones && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
          {["z1", "z2", "z3", "z4", "z5"].map((key) => {
            const min = zones[`${key}_min`];
            const max = zones[`${key}_max`];
            if (min == null && max == null) return null;
            return (
              <div
                key={key}
                className={[SURFACE_INLINE, "px-3 py-2"].join(" ")}
              >
                <div className="text-xs opacity-70 uppercase mb-1">
                  {key.toUpperCase()}
                </div>
                <div className="text-sm tabular-nums">
                  {min ?? "?"} – {max ?? "?"} bpm
                </div>
              </div>
            );
          })}
        </div>
      )}

      {hasThresholds && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {Object.entries(thresholds).map(([k, v]) => (
            <div key={k} className={[SURFACE_INLINE, "px-3 py-2"].join(" ")}>
              <div className="text-xs opacity-70 uppercase mb-1">{k}</div>
              <div className="text-sm tabular-nums">{String(v)}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}