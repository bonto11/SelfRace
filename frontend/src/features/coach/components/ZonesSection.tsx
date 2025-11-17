"use client";

import { useState, useEffect } from "react";
import { SECTION, SURFACE_INLINE } from "@/shared/ui/classes";
import { InfoPopover } from "./InfoPopover";

// mód výpočtu zón
export type ZoneCalcMode = "manual" | "hrmax" | "percent_lthr" | "default";

type Props = {
  zones: any | undefined;
  thresholds: any | undefined;

  onZonesChange: (z: any) => void;
  onThresholdsChange: (t: any) => void;

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

  // mode uložíme len lokálne v tejto sekcii
  const [calcMode, setCalcMode] = useState<ZoneCalcMode>("manual");

  const hasZones = !!zones;
  const hasThresholds = !!thresholds;

  /* ------------------------------------------------------------ */
  /*   VÝPOČET ZÓN PODĽA MODE - HRmax / LTHR / default            */
  /* ------------------------------------------------------------ */

  const recalcZones = (mode: ZoneCalcMode, z: any, thr: any) => {
    console.log("[ZONES] Recalculating based on mode:", mode);

    if (!z) return;

    let hrmax = Number(z.hr_max) || 200;
    let lthr = thr?.HR_bpm ? Number(thr.HR_bpm) : null;

    const out = { ...z };

    if (mode === "manual") return out;

    /* ---- HRmax (%) zóny ---- */
    if (mode === "hrmax") {
      out.z1_min = Math.round(hrmax * 0.50);
      out.z1_max = Math.round(hrmax * 0.60);

      out.z2_min = Math.round(hrmax * 0.60);
      out.z2_max = Math.round(hrmax * 0.70);

      out.z3_min = Math.round(hrmax * 0.70);
      out.z3_max = Math.round(hrmax * 0.80);

      out.z4_min = Math.round(hrmax * 0.80);
      out.z4_max = Math.round(hrmax * 0.90);

      out.z5_min = Math.round(hrmax * 0.90);
      out.z5_max = hrmax;
      return out;
    }

    /* ---- % LTHR ---- */
    if (mode === "percent_lthr" && lthr) {
      out.z1_min = Math.round(lthr * 0.81);
      out.z1_max = Math.round(lthr * 0.89);

      out.z2_min = Math.round(lthr * 0.90);
      out.z2_max = Math.round(lthr * 0.93);

      out.z3_min = Math.round(lthr * 0.94);
      out.z3_max = Math.round(lthr * 0.99);

      out.z4_min = Math.round(lthr * 1.0);
      out.z4_max = Math.round(lthr * 1.06);

      out.z5_min = out.z4_max + 1;
      out.z5_max = out.z5_min + 10;
      return out;
    }

    /* ---- DEFAULT = HRmax, fallback 200 ---- */
    if (mode === "default") {
      const h = hrmax;
      out.z1_min = Math.round(h * 0.50);
      out.z1_max = Math.round(h * 0.60);

      out.z2_min = Math.round(h * 0.60);
      out.z2_max = Math.round(h * 0.70);

      out.z3_min = Math.round(h * 0.70);
      out.z3_max = Math.round(h * 0.80);

      out.z4_min = Math.round(h * 0.80);
      out.z4_max = Math.round(h * 0.90);

      out.z5_min = Math.round(h * 0.90);
      out.z5_max = h;
      return out;
    }

    return out;
  };

  /* ------------------------------------------------------------ */
  /*   Keď sa zmení calculation mode → automaticky prepočítať     */
  /* ------------------------------------------------------------ */

  useEffect(() => {
    if (!zones) return;
    const newZones = recalcZones(calcMode, zones, thresholds);
    onZonesChange(newZones);
  }, [calcMode]);

  /* LOCK inputs when not manual */
  const zonesLocked = calcMode !== "manual";

  return (
    <section className={SECTION}>
      {/* HEADER */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium opacity-90">
          Heart-rate zones & thresholds
        </div>

        <div className="flex items-center gap-2">
          <InfoPopover text="Výpočet zón podľa HRmax, %LTHR alebo manuálne." />
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600"
          >
            {open ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      {/* CLOSED PREVIEW */}
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

      {/* OPEN CONTENT */}
      {open && (
        <div className="space-y-5">

          {/* --------------------------------------------------- */}
          {/* SELECTOR MODE + HRmax input */}
          {/* --------------------------------------------------- */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

            {/* MODE SELECTOR */}
            <div className={[SURFACE_INLINE, "px-3 py-2"].join(" ")}>
              <div className="flex items-center justify-between mb-1">
                <div className="text-xs opacity-70">Zone calculation</div>
                <InfoPopover text="Vyber spôsob výpočtu zón." />
              </div>

              <select
                value={calcMode}
                onChange={(e) =>
                  setCalcMode(e.target.value as ZoneCalcMode)
                }
                className="w-full bg-gray-800 px-2 py-1 rounded text-sm"
              >
                <option value="manual">Manual (test/custom)</option>
                <option value="hrmax">From HRmax (%)</option>
                <option value="percent_lthr">From % LTHR</option>
                <option value="default">Internal default</option>
              </select>
            </div>

            {/* HRmax */}
            <div className={[SURFACE_INLINE, "px-3 py-2"].join(" ")}>
              <div className="text-xs opacity-70 mb-1">HRmax (bpm)</div>

              <input
                type="number"
                className="bg-gray-800 px-2 py-1 rounded w-full"
                value={zones?.hr_max ?? ""}
                onChange={(e) => {
                  const val = e.target.value ? Number(e.target.value) : null;
                  const next = { ...zones, hr_max: val };
                  onZonesChange(next);

                  // Auto recalculation when HRmax changes
                  if (calcMode !== "manual") {
                    const recalc = recalcZones(calcMode, next, thresholds);
                    onZonesChange(recalc);
                  }
                }}
              />
            </div>
          </div>

          {/* --------------------------------------------------- */}
          {/* ZONES EDITOR */}
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
                          disabled={zonesLocked}
                          type="number"
                          className="bg-gray-800 px-2 py-1 rounded w-20 disabled:opacity-40"
                          value={zones[minKey] ?? ""}
                          onChange={(e) =>
                            onZonesChange({
                              ...zones,
                              [minKey]: e.target.value
                                ? Number(e.target.value)
                                : null,
                            })
                          }
                        />

                        <span className="opacity-60">–</span>

                        <input
                          disabled={zonesLocked}
                          type="number"
                          className="bg-gray-800 px-2 py-1 rounded w-20 disabled:opacity-40"
                          value={zones[maxKey] ?? ""}
                          onChange={(e) =>
                            onZonesChange({
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
                  onClick={() => {
                    console.log("[ZONES] Saving to DB:", zones);
                    onSaveZonesToDB(zones);
                  }}
                  className="text-xs mt-2 px-3 py-1 rounded bg-green-700 hover:bg-green-600"
                >
                  Save zones to DB
                </button>
              )}
            </>
          )}

          {/* --------------------------------------------------- */}
          {/* THRESHOLDS */}
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
                        onThresholdsChange({
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
                  onClick={() => {
                    console.log("[THRESHOLDS] Saving to DB:", thresholds);
                    onSaveThresholdsToDB(thresholds);
                  }}
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