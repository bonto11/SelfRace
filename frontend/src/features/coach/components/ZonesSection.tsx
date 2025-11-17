"use client";

import { useEffect, useMemo, useState } from "react";
import { SECTION, SURFACE_INLINE } from "@/shared/ui/classes";
import { InfoPopover } from "./InfoPopover";

type Zones = {
  z1_min?: number | null;
  z1_max?: number | null;
  z2_min?: number | null;
  z2_max?: number | null;
  z3_min?: number | null;
  z3_max?: number | null;
  z4_min?: number | null;
  z4_max?: number | null;
  z5_min?: number | null;
  z5_max?: number | null;
  hr_max?: number | null;
  [k: string]: any;
};

type Thresholds = {
  hr_bpm?: number | null;
  pace_sec_km?: number | null;
  threshold_type?: string | null;
  measurement_type?: string | null;
  [k: string]: any;
};

type ZoneCalcMode = "manual" | "hrmax_simple" | "lthr_percent";

type Props = {
  zones: Zones | undefined;
  thresholds: Thresholds | undefined;
  onZonesChange: (z: Zones | undefined) => void;
  onThresholdsChange: (t: Thresholds | undefined) => void;
  onSaveZonesToDB?: (z: Zones | undefined) => Promise<void> | void;
  onSaveThresholdsToDB?: (t: Thresholds | undefined) => Promise<void> | void;
};

const ZONES_KEYS = ["z1", "z2", "z3", "z4", "z5"] as const;

export function ZonesSection({
  zones,
  thresholds,
  onZonesChange,
  onThresholdsChange,
  onSaveZonesToDB,
  onSaveThresholdsToDB,
}: Props) {
  const [mode, setMode] = useState<ZoneCalcMode>("manual");
  const [editZones, setEditZones] = useState<Zones | undefined>(zones);
  const [editThr, setEditThr] = useState<Thresholds | undefined>(thresholds);

  // keď sa props zmenia zvonka (refresh), prepis lokálny stav
  useEffect(() => {
    setEditZones(zones);
  }, [zones]);
  useEffect(() => {
    setEditThr(thresholds);
  }, [thresholds]);

  const hasZones = !!editZones;
  const hasThresholds = !!editThr;

  const hrMax = useMemo<number | null>(() => {
    if (!editZones) return null;
    if (typeof editZones.hr_max === "number") return editZones.hr_max;
    if (typeof editZones.z5_max === "number") return editZones.z5_max;
    return null;
  }, [editZones]);

  const lthr = useMemo<number | null>(() => {
    if (!editThr) return null;
    if (typeof editThr.hr_bpm === "number") return editThr.hr_bpm;
    return null;
  }, [editThr]);

  const modeHelp: Record<ZoneCalcMode, string> = {
    manual:
      "Manuálne zadáš hranice zón. Najpresnejšie pri kvalitnom laktátovom/gas-analysis teste. Planner zóny len použije, nič neprepočítava.",
    hrmax_simple:
      "Zóny sa rátajú ako % z HRmax (napr. Z1 ~50–60 %, Z2 ~60–70 %, …). Rýchle riešenie, ale pri vytrvalcoch často nepresné (Z2 býva príliš vysoká).",
    lthr_percent:
      "Zóny sa rátajú ako % z LTHR (anaeróbny prah, napr. Garmin LT). Presnejšie pre beh ako klasické %HRmax, ale stále závislé od kvality odhadu prahu.",
  };

  function updateZoneBound(
    zoneKey: string,
    bound: "min" | "max",
    value: string
  ) {
    const v =
      value === "" || Number.isNaN(Number(value)) ? null : Number(value);
    setEditZones((prev) => {
      const base: Zones = prev ? { ...prev } : {};
      base[`${zoneKey}_${bound}`] = v;
      onZonesChange(base);
      return base;
    });
  }

  function updateHrMax(value: string) {
    const v =
      value === "" || Number.isNaN(Number(value)) ? null : Number(value);
    setEditZones((prev) => {
      const base: Zones = prev ? { ...prev } : {};
      base.hr_max = v;
      onZonesChange(base);
      return base;
    });
  }

  function updateThresholdField(field: keyof Thresholds, value: string) {
    const v =
      value === "" || Number.isNaN(Number(value)) ? null : Number(value);
    setEditThr((prev) => {
      const base: Thresholds = prev ? { ...prev } : {};
      (base as any)[field] = v;
      onThresholdsChange(base);
      return base;
    });
  }

  // jednoduchý model zón podľa HRmax
  function recalcFromHrMax() {
    if (!hrMax) return;
    const z1_min = Math.round(hrMax * 0.5);
    const z1_max = Math.round(hrMax * 0.6);
    const z2_min = z1_max + 1;
    const z2_max = Math.round(hrMax * 0.7);
    const z3_min = z2_max + 1;
    const z3_max = Math.round(hrMax * 0.8);
    const z4_min = z3_max + 1;
    const z4_max = Math.round(hrMax * 0.9);
    const z5_min = z4_max + 1;
    const z5_max = hrMax;

    const next: Zones = {
      ...(editZones ?? {}),
      hr_max: hrMax,
      z1_min,
      z1_max,
      z2_min,
      z2_max,
      z3_min,
      z3_max,
      z4_min,
      z4_max,
      z5_min,
      z5_max,
    };
    setEditZones(next);
    onZonesChange(next);
  }

  // model zón podľa LTHR (Friel-style percentá)
  function recalcFromLthr() {
    if (!lthr) return;
    const z1_min = Math.round(lthr * 0.8);
    const z1_max = Math.round(lthr * 0.89);
    const z2_min = z1_max + 1;
    const z2_max = Math.round(lthr * 0.94);
    const z3_min = z2_max + 1;
    const z3_max = Math.round(lthr * 0.99);
    const z4_min = lthr;
    const z4_max = lthr + 4;
    const z5_min = z4_max + 1;
    const z5_max = lthr + 15;

    const next: Zones = {
      ...(editZones ?? {}),
      z1_min,
      z1_max,
      z2_min,
      z2_max,
      z3_min,
      z3_max,
      z4_min,
      z4_max,
      z5_min,
      z5_max,
    };
    setEditZones(next);
    onZonesChange(next);
  }

  // pri zmene mode len prepočítame, ak dáva zmysel
  useEffect(() => {
    if (mode === "hrmax_simple") recalcFromHrMax();
    if (mode === "lthr_percent") recalcFromLthr();
    // manual nerobí nič
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const disableHrMaxCalc = !hrMax;
  const disableLthrCalc = !lthr;

  return (
    <section className={SECTION}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium opacity-90">
          Heart-rate zones & thresholds
        </div>
        <InfoPopover text="Zóny sa používajú na plánovanie intenzity. Ak máš test / Garmin odhad, vieš ich prebrať z HRmax alebo LTHR. Inak môžeš zadať vlastné manuálne." />
      </div>

      {/* mode selector + help */}
      <div className="mb-3 grid grid-cols-1 sm:grid-cols-[minmax(0,260px)_minmax(0,1fr)] gap-2">
        <div className={[SURFACE_INLINE, "px-3 py-2 flex flex-col gap-1"].join(" ")}>
          <div className="flex items-center justify-between">
            <span className="text-xs opacity-70">Zone calculation</span>
            <InfoPopover text={modeHelp[mode]} />
          </div>
          <select
            className="mt-1 bg-transparent border border-white/15 rounded px-2 py-1 text-sm"
            value={mode}
            onChange={(e) => setMode(e.target.value as ZoneCalcMode)}
          >
            <option value="manual">Manual (test / custom)</option>
            <option value="hrmax_simple">From HRmax (%HRmax)</option>
            <option value="lthr_percent">From LTHR (% of threshold)</option>
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {/* HRmax input */}
          <div className={[SURFACE_INLINE, "px-3 py-2 flex flex-col gap-1"].join(" ")}>
            <div className="flex items-center justify-between">
              <span className="text-xs opacity-70">HRmax (bpm)</span>
              <span className="text-xs opacity-60">
                {disableHrMaxCalc ? "Needed for %HRmax" : ""}
              </span>
            </div>
            <input
              type="number"
              className="mt-1 bg-transparent border border-white/15 rounded px-2 py-1 text-sm w-full"
              value={hrMax ?? ""}
              onChange={(e) => updateHrMax(e.target.value)}
              placeholder="e.g. 200"
            />
          </div>

          {/* LTHR input */}
          <div className={[SURFACE_INLINE, "px-3 py-2 flex flex-col gap-1"].join(" ")}>
            <div className="flex items-center justify-between">
              <span className="text-xs opacity-70">LTHR / Threshold HR (bpm)</span>
              <span className="text-xs opacity-60">
                {disableLthrCalc ? "Needed for %LTHR" : ""}
              </span>
            </div>
            <input
              type="number"
              className="mt-1 bg-transparent border border-white/15 rounded px-2 py-1 text-sm w-full"
              value={editThr?.hr_bpm ?? ""}
              onChange={(e) => updateThresholdField("hr_bpm", e.target.value)}
              placeholder="e.g. 186"
            />
          </div>
        </div>
      </div>

      {/* zóny – editable */}
      <div className="mb-3">
        {hasZones ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ZONES_KEYS.map((key) => {
              const minKey = `${key}_min`;
              const maxKey = `${key}_max`;
              const minVal = (editZones as any)?.[minKey] ?? "";
              const maxVal = (editZones as any)?.[maxKey] ?? "";

              if (minVal === "" && maxVal === "" && mode !== "manual") {
                // pri automatike môžu byť doplnené neskôr, ale necháme ich zobrazené
              }

              return (
                <div
                  key={key}
                  className={[SURFACE_INLINE, "px-3 py-2 flex flex-col gap-1"].join(" ")}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-xs opacity-70 uppercase">
                      {key.toUpperCase()}
                    </div>
                    <div className="text-xs opacity-60">bpm</div>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="number"
                      className="w-full bg-transparent border border-white/15 rounded px-2 py-1 text-sm"
                      value={minVal}
                      onChange={(e) => updateZoneBound(key, "min", e.target.value)}
                      placeholder="min"
                    />
                    <span className="text-xs opacity-70">–</span>
                    <input
                      type="number"
                      className="w-full bg-transparent border border-white/15 rounded px-2 py-1 text-sm"
                      value={maxVal}
                      onChange={(e) => updateZoneBound(key, "max", e.target.value)}
                      placeholder="max"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div
            className={[SURFACE_INLINE, "px-3 py-2 text-xs opacity-70"].join(" ")}
          >
            No zones found – either enter them manually or let the app derive
            them from HRmax / LTHR.
          </div>
        )}
      </div>

      {/* thresholds detail */}
      <div className="mb-3">
        {hasThresholds ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className={[SURFACE_INLINE, "px-3 py-2 flex flex-col gap-1"].join(" ")}>
              <div className="text-xs opacity-70 mb-1">Threshold HR (bpm)</div>
              <input
                type="number"
                className="bg-transparent border border-white/15 rounded px-2 py-1 text-sm"
                value={editThr?.hr_bpm ?? ""}
                onChange={(e) => updateThresholdField("hr_bpm", e.target.value)}
              />
            </div>
            <div className={[SURFACE_INLINE, "px-3 py-2 flex flex-col gap-1"].join(" ")}>
              <div className="text-xs opacity-70 mb-1">
                Threshold pace (sec/km)
              </div>
              <input
                type="number"
                className="bg-transparent border border-white/15 rounded px-2 py-1 text-sm"
                value={editThr?.pace_sec_km ?? ""}
                onChange={(e) =>
                  updateThresholdField("pace_sec_km", e.target.value)
                }
                placeholder="e.g. 295 (=4:55/km)"
              />
            </div>
          </div>
        ) : (
          <div
            className={[SURFACE_INLINE, "px-3 py-2 text-xs opacity-70"].join(" ")}
          >
            No threshold found – you can type your LT HR and pace here and save
            it to DB once backend is ready.
          </div>
        )}
      </div>

      {/* actions */}
      <div className="flex flex-wrap gap-2">
        {onSaveZonesToDB && (
          <button
            type="button"
            className="px-3 py-1.5 text-xs rounded border border-emerald-500 bg-emerald-600/90 hover:bg-emerald-500/90"
            onClick={() => onSaveZonesToDB(editZones)}
          >
            Save zones to DB
          </button>
        )}
        {onSaveThresholdsToDB && (
          <button
            type="button"
            className="px-3 py-1.5 text-xs rounded border border-emerald-500 bg-emerald-600/90 hover:bg-emerald-500/90"
            onClick={() => onSaveThresholdsToDB(editThr)}
          >
            Save threshold to DB
          </button>
        )}
      </div>
    </section>
  );
}