"use client";

import { useState } from "react";
import { SECTION, SURFACE_INLINE } from "@/shared/ui/classes";
import { InfoPopover } from "./InfoPopover";

type Props = {
  zones: any | undefined;
  thresholds: any | undefined;
  onZonesChange?: (z: any) => void;
  onThresholdsChange?: (t: any) => void;
  onSaveZonesToDB?: (z: any) => Promise<void>;
  onSaveThresholdsToDB?: (t: any) => Promise<void>;
};

export function ZonesSection({
  zones,
  thresholds,
  onZonesChange,
  onThresholdsChange,
  onSaveZonesToDB,
  onSaveThresholdsToDB,
}: Props) {
  const [open, setOpen] = useState(false);

  const hasZones = !!zones;
  const hasThresholds = !!thresholds;

  return (
    <section className={SECTION}>
      {/* HEADER */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium opacity-90">
          Heart-rate zones & thresholds
        </div>

        <div className="flex items-center gap-2">
          <InfoPopover text="Zóny a prahy načítané z testov alebo manuálne upravené." />

          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600"
          >
            {open ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      {/* CLOSED STATE */}
      {!open && (
        <div
          className={[
            SURFACE_INLINE,
            "px-3 py-2 text-xs opacity-70 select-none",
          ].join(" ")}
        >
          {hasZones || hasThresholds
            ? "Click Show to view or edit your zones."
            : "No HR zones or thresholds found."}
        </div>
      )}

      {/* OPEN STATE */}
      {open && (
        <div className="space-y-4">
          {/* -------------------- ZONES -------------------- */}
          {hasZones && (
            <>
              <div className="text-xs opacity-70 mb-1">Zones (bpm)</div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {["z1", "z2", "z3", "z4", "z5"].map((key) => {
                  const minKey = `${key}_min`;
                  const maxKey = `${key}_max`;

                  return (
                    <div
                      key={key}
                      className={[SURFACE_INLINE, "px-3 py-2"].join(" ")}
                    >
                      <div className="text-xs opacity-70 uppercase mb-1">
                        {key.toUpperCase()}
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          className="bg-gray-800 px-2 py-1 rounded w-20"
                          value={
                            typeof zones[minKey] === "number"
                              ? zones[minKey]
                              : ""
                          }
                          onChange={(e) =>
                            onZonesChange?.({
                              ...zones,
                              [minKey]: e.target.value
                                ? Number(e.target.value)
                                : null,
                            })
                          }
                        />

                        <span className="opacity-60">–</span>

                        <input
                          type="number"
                          className="bg-gray-800 px-2 py-1 rounded w-20"
                          value={
                            typeof zones[maxKey] === "number"
                              ? zones[maxKey]
                              : ""
                          }
                          onChange={(e) =>
                            onZonesChange?.({
                              ...zones,
                              [maxKey]: e.target.value
                                ? Number(e.target.value)
                                : null,
                            })
                          }
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {onSaveZonesToDB && (
                <button
                  type="button"
                  onClick={() => onSaveZonesToDB(zones)}
                  className="text-xs mt-2 px-3 py-1 rounded bg-green-700 hover:bg-green-600"
                >
                  Save zones to DB
                </button>
              )}
            </>
          )}

          {/* -------------------- THRESHOLDS -------------------- */}
          {hasThresholds && (
            <>
              <div className="text-xs opacity-70 mt-4 mb-1">Thresholds</div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.entries(thresholds ?? {}).map(([key, val]) => (
                  <div
                    key={key}
                    className={[SURFACE_INLINE, "px-3 py-2"].join(" ")}
                  >
                    <div className="text-xs opacity-70 uppercase mb-1">
                      {key}
                    </div>

                    <input
                      type="number"
                      className="bg-gray-800 px-2 py-1 rounded w-24"
                      value={typeof val === "number" ? val : ""}
                      onChange={(e) =>
                        onThresholdsChange?.({
                          ...thresholds,
                          [key]: e.target.value
                            ? Number(e.target.value)
                            : null,
                        })
                      }
                    />
                  </div>
                ))}
              </div>

              {onSaveThresholdsToDB && (
                <button
                  type="button"
                  onClick={() => onSaveThresholdsToDB(thresholds)}
                  className="text-xs mt-2 px-3 py-1 rounded bg-green-700 hover:bg-green-600"
                >
                  Save thresholds to DB
                </button>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}