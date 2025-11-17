"use client";

import { useState } from "react";
import { SECTION, SURFACE_INLINE } from "@/shared/ui/classes";
import { InfoPopover } from "./InfoPopover";

type ZoneCalcMode = "manual" | "hrmax" | "percent_lthr" | "default";

type Props = {
  zones: any | undefined;
  thresholds: any | undefined;
  zoneCalcMode?: ZoneCalcMode;
  onZoneCalcModeChange?: (m: ZoneCalcMode) => void;
  onZonesChange?: (z: any) => void;
  onThresholdsChange?: (t: any) => void;
  onSaveZonesToDB?: (z: any) => Promise<void>;
  onSaveThresholdsToDB?: (t: any) => Promise<void>;
};

export function ZonesSection({
  zones,
  thresholds,
  zoneCalcMode = "manual",
  onZoneCalcModeChange,
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
          <InfoPopover text="Zóny vypočítané manuálne, z HRmax alebo z percent LTHR." />
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600"
          >
            {open ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      {/* CLOSED */}
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

      {/* OPEN */}
      {open && (
        <div className="space-y-5">
          {/* --------------------------------------------------- */}
          {/*   ZONE CALC MODE + HRmax                          */}
          {/* --------------------------------------------------- */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* SELECTOR */}
            <div className={[SURFACE_INLINE, "px-3 py-2"].join(" ")}>
              <div className="flex items-center justify-between mb-1">
                <div className="text-xs opacity-70">Zone calculation</div>
                <InfoPopover
                  text={
                    zoneCalcMode === "manual"
                      ? "Manuálne nastavenie zón = najpresnejšie ak máš kvalitný test."
                      : zoneCalcMode === "hrmax"
                      ? "Vypočítané z percent z HRmax. Menej presné pri dlhých behov."
                      : zoneCalcMode === "percent_lthr"
                      ? "Zóny z percent laktátového prahu. Veľmi presné pre endurance."
                      : "Interné default hodnoty (ak nič iné nemáš)."
                  }
                />
              </div>

              <select
                value={zoneCalcMode}
                onChange={(e) =>
                  onZoneCalcModeChange?.(e.target.value as ZoneCalcMode)
                }
                className="w-full bg-gray-800 px-2 py-1 rounded text-sm"
              >
                <option value="manual">Manual (test/custom)</option>
                <option value="hrmax">From HRmax (%)</option>
                <option value="percent_lthr">From % LTHR</option>
                <option value="default">Internal default</option>
              </select>
            </div>

            {/* HRmax INPUT */}
            <div className={[SURFACE_INLINE, "px-3 py-2"].join(" ")}>
              <div className="text-xs opacity-70 mb-1">HRmax (bpm)</div>
              <input
                type="number"
                className="bg-gray-800 px-2 py-1 rounded w-full"
                value={zones?.hr_max ?? ""}
                onChange={(e) =>
                  onZonesChange?.({
                    ...zones,
                    hr_max: e.target.value ? Number(e.target.value) : null,
                  })
                }
              />
            </div>
          </div>

          {/* --------------------------------------------------- */}
          {/*   ZONES EDITOR                                     */}
          {/* --------------------------------------------------- */}
          {hasZones && (
            <>
              <div className="text-xs opacity-70">Zones (bpm)</div>
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
                          value={zones[minKey] ?? ""}
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
                          value={zones[maxKey] ?? ""}
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

          {/* --------------------------------------------------- */}
          {/*   THRESHOLDS EDITOR                                */}
          {/* --------------------------------------------------- */}
          {hasThresholds && (
            <>
              <div className="text-xs opacity-70">Thresholds</div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.entries(thresholds).map(([key, val]: any) => (
                  <div
                    key={key}
                    className={[SURFACE_INLINE, "px-3 py-2"].join(" ")}
                  >
                    <div className="text-xs opacity-70 uppercase mb-1">
                      {key}
                    </div>
                    <input
                      type="number"
                      className="bg-gray-800 px-2 py-1 rounded w-full"
                      value={val ?? ""}
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