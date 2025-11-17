"use client";

import { useState, useEffect } from "react";
import { SECTION, SURFACE_INLINE, PILL_BUTTON } from "@/shared/ui/classes";
import { InfoPopover } from "./InfoPopover";

type Props = {
  zones: any;
  thresholds: any;
  onZonesChange: (z: any) => void;
  onThresholdsChange: (t: any) => void;
  onSaveZonesToDB: (z: any) => Promise<void>;
  onSaveThresholdsToDB: (t: any) => Promise<void>;
};

export function ZonesSection({
  zones,
  thresholds,
  onZonesChange,
  onThresholdsChange,
  onSaveZonesToDB,
  onSaveThresholdsToDB,
}: Props) {
  // lokálny stav – FE edituje, parent dostáva až keď zmeníme
  const [localZones, setLocalZones] = useState<any>(zones ?? {});
  const [localThr, setLocalThr] = useState<any>(thresholds ?? {});

  // keď prídu nové zóny z DB → prepíš lokálny
  useEffect(() => {
    setLocalZones(zones ?? {});
  }, [zones]);

  useEffect(() => {
    setLocalThr(thresholds ?? {});
  }, [thresholds]);

  const updateZoneField = (key: string, val: number | null) => {
    const next = { ...localZones, [key]: val };
    console.log("[ZonesSection] updateZoneField", next);
    setLocalZones(next);
    onZonesChange(next);
  };

  const updateThresholdField = (key: string, val: number | null) => {
    const next = { ...localThr, [key]: val };
    console.log("[ZonesSection] updateThresholdField", next);
    setLocalThr(next);
    onThresholdsChange(next);
  };

  const saveZones = async () => {
    console.log("[ZonesSection] SAVE ZONES to DB", localZones);
    await onSaveZonesToDB(localZones);
  };

  const saveThresholds = async () => {
    console.log("[ZonesSection] SAVE THRESHOLDS to DB", localThr);
    await onSaveThresholdsToDB(localThr);
  };

  return (
    <section className={SECTION}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium opacity-90">
          Heart-rate zones & thresholds
        </div>
        <InfoPopover text="Uprav zóny alebo prahy a ulož do databázy." />
      </div>

      {/* --- ZONES EDIT --- */}
      <div className="mb-3">
        <div className="text-xs opacity-70 mb-1">Zones (Z1 – Z5)</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {["z1", "z2", "z3", "z4", "z5"].map((z) => (
            <div key={z} className={[SURFACE_INLINE, "px-3 py-2"].join(" ")}>
              <div className="text-xs uppercase opacity-70 mb-1">
                {z.toUpperCase()}
              </div>
              <div className="flex gap-2 items-center">
                <input
                  type="number"
                  className="w-20 bg-gray-800 px-2 py-1 rounded"
                  value={localZones?.[`${z}_min`] ?? ""}
                  onChange={(e) =>
                    updateZoneField(
                      `${z}_min`,
                      e.target.value ? Number(e.target.value) : null
                    )
                  }
                />
                <span>–</span>
                <input
                  type="number"
                  className="w-20 bg-gray-800 px-2 py-1 rounded"
                  value={localZones?.[`${z}_max`] ?? ""}
                  onChange={(e) =>
                    updateZoneField(
                      `${z}_max`,
                      e.target.value ? Number(e.target.value) : null
                    )
                  }
                />
                <span className="text-xs opacity-60">bpm</span>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          className={[PILL_BUTTON, "mt-2"].join(" ")}
          onClick={saveZones}
        >
          Save zones to DB
        </button>
      </div>

      {/* --- THRESHOLDS --- */}
      <div>
        <div className="text-xs opacity-70 mb-1">Thresholds</div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
          {Object.entries(localThr ?? {}).map(([key, val]) => (
            <div
              key={key}
              className={[SURFACE_INLINE, "px-3 py-2 flex flex-col"].join(" ")}
            >
              <div className="text-xs uppercase opacity-70 mb-1">{key}</div>
              <input
                type="number"
                className="bg-gray-800 px-2 py-1 rounded w-24"
                value={typeof val === "number" ? val : ""}
                onChange={(e) =>
                  updateThresholdField(
                    key,
                    e.target.value ? Number(e.target.value) : null
                  )
                }
              />
            </div>
          ))}
        </div>

        <button
          type="button"
          className={[PILL_BUTTON].join(" ")}
          onClick={saveThresholds}
        >
          Save thresholds to DB
        </button>
      </div>
    </section>
  );
}