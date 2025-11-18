"use client";

import { useState, useEffect } from "react";
import { SECTION, SURFACE_INLINE } from "@/shared/ui/classes";
import { InfoPopover } from "./InfoPopover";
import { toast } from "@/shared/components/ui/Toast";

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

/* ---------------- ZONES VALIDATION ---------------- */

const ZONE_KEYS: string[] = [
  "z1_min",
  "z1_max",
  "z2_min",
  "z2_max",
  "z3_min",
  "z3_max",
  "z4_min",
  "z4_max",
  "z5_min",
  "z5_max",
];

function validateZones(z: any): string[] {
  if (!z) return ["Zones payload is empty"];

  const errors: string[] = [];

  for (const key of ZONE_KEYS) {
    const v = z[key];
    if (v == null || Number.isNaN(Number(v))) {
      errors.push(`Field ${key} must be a number (got ${v ?? "empty"})`);
    }
  }

  if (errors.length) return errors;

  const {
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
    hr_max,
  } = z as Record<string, number>;

  const pairs: Array<[number, number, string]> = [
    [z1_min, z1_max, "Z1"],
    [z2_min, z2_max, "Z2"],
    [z3_min, z3_max, "Z3"],
    [z4_min, z4_max, "Z4"],
    [z5_min, z5_max, "Z5"],
  ];

  for (const [min, max, label] of pairs) {
    if (min >= max) {
      errors.push(`${label}: min must be < max (${min} vs ${max})`);
    }
  }

  if (
    !(
      z1_max < z2_min &&
      z2_max <= z3_min &&
      z3_max <= z4_min &&
      z4_max <= z5_min
    )
  ) {
    errors.push(
      "Zones should be ordered and non-overlapping (Z1 < Z2 < Z3 < Z4 < Z5).",
    );
  }

  if (hr_max && z5_max > hr_max) {
    errors.push(`Z5 max (${z5_max}) must be ≤ HRmax (${hr_max}).`);
  }

  return errors;
}

/* ---------------- THRESHOLDS VALIDATION ---------------- */

const THR_NUMERIC_KEYS = new Set(["HR_bpm", "pace_sec_km", "power_watt"]);
const THR_READONLY_KEYS = new Set(["updated_at", "user_uid", "user_id"]);
// value zahadzujeme – nebudeme ho ani zobrazovať

function validateThresholds(t: any): string[] {
  if (!t) return ["Threshold payload is empty"];

  const errors: string[] = [];

  if (t.HR_bpm != null && t.HR_bpm !== "") {
    const hr = Number(t.HR_bpm);
    if (!Number.isFinite(hr)) {
      errors.push("Threshold HR (HR_bpm) must be a number.");
    } else if (hr < 100 || hr > 230) {
      errors.push("Threshold HR (HR_bpm) looks unrealistic (100–230 bpm).");
    }
  }

  if (t.pace_sec_km != null && t.pace_sec_km !== "") {
    const p = Number(t.pace_sec_km);
    if (!Number.isFinite(p) || p <= 0) {
      errors.push("pace_sec_km must be a positive number (seconds per km).");
    }
  }

  if (t.power_watt != null && t.power_watt !== "") {
    const w = Number(t.power_watt);
    if (!Number.isFinite(w) || w <= 0) {
      errors.push("power_watt must be a positive number.");
    }
  }

  return errors;
}

/* -------- pomocné na pace min/km <-> sek/km -------- */

function secToPaceString(sec: number | null | undefined): string {
  if (!sec || !Number.isFinite(sec)) return "";
  const s = Math.round(Number(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function paceStringToSec(val: string): number | null {
  if (!val.trim()) return null;
  // podpora "4:55" aj "295"
  if (val.includes(":")) {
    const [mStr, sStr] = val.split(":");
    const m = Number(mStr);
    const s = Number(sStr);
    if (!Number.isFinite(m) || !Number.isFinite(s)) return null;
    return m * 60 + s;
  }
  const n = Number(val);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/* ---------------- COMPONENT ---------------- */

export function ZonesSection({
  zones,
  thresholds,
  onZonesChange,
  onThresholdsChange,
  onSaveZonesToDB,
  onSaveThresholdsToDB,
}: Props) {
  const [open, setOpen] = useState(false);
  const [calcMode, setCalcMode] = useState<ZoneCalcMode>("manual");

  // keď z DB nič nepríde, spravíme default zóny, aby sa zobrazil editor
  const effectiveZones =
    zones ?? {
      hr_max: 200,
      z1_min: 0,
      z1_max: 119,
      z2_min: 120,
      z2_max: 139,
      z3_min: 140,
      z3_max: 159,
      z4_min: 160,
      z4_max: 179,
      z5_min: 180,
      z5_max: 200,
    };

  const effectiveThr = thresholds ?? {
    sport: "",
    threshold_type: "",
    HR_bpm: "",
    pace_sec_km: "",
    power_watt: "",
    measurement_type: "",
    updated_at: "",
  };

  const hasZones = true; // vždy zobrazíme grid (už máme effectiveZones)
  const hasThresholds = true; // editor zobrazíme, aj keď je to zatiaľ prázdne

  /* ------------------------------------------------------------ */
  /*   VÝPOČET ZÓN PODĽA MODE                                    */
  /* ------------------------------------------------------------ */

  const recalcZones = (mode: ZoneCalcMode, z: any, thr: any) => {
    console.log("[ZONES] Recalculating based on mode:", mode);

    if (!z) return z;

    let hrmax = Number(z.hr_max) || 200;
    let lthr = thr?.HR_bpm ? Number(thr.HR_bpm) : null;

    const out = { ...z };

    if (mode === "manual") return out;

    if (mode === "hrmax") {
      out.z1_min = Math.round(hrmax * 0.5);
      out.z1_max = Math.round(hrmax * 0.6);

      out.z2_min = Math.round(hrmax * 0.6);
      out.z2_max = Math.round(hrmax * 0.7);

      out.z3_min = Math.round(hrmax * 0.7);
      out.z3_max = Math.round(hrmax * 0.8);

      out.z4_min = Math.round(hrmax * 0.8);
      out.z4_max = Math.round(hrmax * 0.9);

      out.z5_min = Math.round(hrmax * 0.9);
      out.z5_max = hrmax;
      return out;
    }

    if (mode === "percent_lthr" && lthr) {
      out.z1_min = Math.round(lthr * 0.81);
      out.z1_max = Math.round(lthr * 0.89);

      out.z2_min = Math.round(lthr * 0.9);
      out.z2_max = Math.round(lthr * 0.93);

      out.z3_min = Math.round(lthr * 0.94);
      out.z3_max = Math.round(lthr * 0.99);

      out.z4_min = Math.round(lthr * 1.0);
      out.z4_max = Math.round(lthr * 1.06);

      out.z5_min = out.z4_max + 1;
      out.z5_max = out.z5_min + 10;
      return out;
    }

    if (mode === "default") {
      const h = hrmax;
      out.z1_min = Math.round(h * 0.5);
      out.z1_max = Math.round(h * 0.6);

      out.z2_min = Math.round(h * 0.6);
      out.z2_max = Math.round(h * 0.7);

      out.z3_min = Math.round(h * 0.7);
      out.z3_max = Math.round(h * 0.8);

      out.z4_min = Math.round(h * 0.8);
      out.z4_max = Math.round(h * 0.9);

      out.z5_min = Math.round(h * 0.9);
      out.z5_max = h;
      return out;
    }

    return out;
  };

  useEffect(() => {
    if (!zones) return;
    const newZones = recalcZones(calcMode, zones, thresholds);
    onZonesChange(newZones);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calcMode]);

  const zonesLocked = calcMode !== "manual";

  /* threshold select options */
  const SPORT_OPTIONS = ["running", "cycling", "triathlon"];
  const THR_TYPE_OPTIONS = ["LT1", "LT2", "FTP", "CP", "custom"];
  const MEAS_TYPE_OPTIONS = [
    "lab",
    "field test",
    "estimate garmin",
    "estimate polar",
    "coach",
  ];

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

      {!open && (
        <div
          className={[
            SURFACE_INLINE,
            "px-3 py-2 text-xs opacity-70 select-none",
          ].join(" ")}
        >
          Click Show to view or edit your zones and thresholds.
        </div>
      )}

      {open && (
        <div className="space-y-5">
          {/* MODE + HRmax */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

            <div className={[SURFACE_INLINE, "px-3 py-2"].join(" ")}>
              <div className="text-xs opacity-70 mb-1">HRmax (bpm)</div>
              <input
                type="number"
                className="bg-gray-800 px-2 py-1 rounded w-full"
                value={effectiveZones.hr_max ?? ""}
                onChange={(e) => {
                  const val = e.target.value ? Number(e.target.value) : null;
                  const next = { ...effectiveZones, hr_max: val };
                  onZonesChange(next);
                  if (calcMode !== "manual") {
                    const recalc = recalcZones(calcMode, next, thresholds);
                    onZonesChange(recalc);
                  }
                }}
              />
            </div>
          </div>

          {/* ZONES EDITOR */}
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
                          value={effectiveZones[minKey] ?? ""}
                          onChange={(e) =>
                            onZonesChange({
                              ...effectiveZones,
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
                          value={effectiveZones[maxKey] ?? ""}
                          onChange={(e) =>
                            onZonesChange({
                              ...effectiveZones,
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
                  onClick={async () => {
                    const errs = validateZones(effectiveZones);
                    if (errs.length) {
                      console.warn("[ZONES] Validation failed:", errs);
                      toast.error(errs[0]);
                      return;
                    }
                    console.log("[ZONES] Saving to DB:", effectiveZones);
                    await onSaveZonesToDB(effectiveZones);
                  }}
                  className="text-xs mt-2 px-3 py-1 rounded bg-green-700 hover:bg-green-600"
                >
                  Save zones to DB
                </button>
              )}
            </>
          )}

          {/* THRESHOLDS EDITOR */}
          {hasThresholds && (
            <>
              <div className="text-xs opacity-70">Thresholds</div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* SPORT */}
                <div className={[SURFACE_INLINE, "px-3 py-2"].join(" ")}>
                  <div className="text-xs opacity-70 uppercase mb-1">SPORT</div>
                  <select
                    className="bg-gray-800 px-2 py-1 rounded w-full"
                    value={effectiveThr.sport ?? ""}
                    onChange={(e) =>
                      onThresholdsChange({
                        ...effectiveThr,
                        sport: e.target.value,
                      })
                    }
                  >
                    <option value="">(select)</option>
                    {SPORT_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                {/* THRESHOLD_TYPE */}
                <div className={[SURFACE_INLINE, "px-3 py-2"].join(" ")}>
                  <div className="text-xs opacity-70 uppercase mb-1">
                    THRESHOLD_TYPE
                  </div>
                  <select
                    className="bg-gray-800 px-2 py-1 rounded w-full"
                    value={effectiveThr.threshold_type ?? ""}
                    onChange={(e) =>
                      onThresholdsChange({
                        ...effectiveThr,
                        threshold_type: e.target.value,
                      })
                    }
                  >
                    <option value="">(select)</option>
                    {THR_TYPE_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                {/* UPDATED_AT (read only) */}
                <div className={[SURFACE_INLINE, "px-3 py-2"].join(" ")}>
                  <div className="text-xs opacity-70 uppercase mb-1">
                    UPDATED_AT
                  </div>
                  <input
                    className="bg-gray-800 px-2 py-1 rounded w-full disabled:opacity-60"
                    disabled
                    value={effectiveThr.updated_at ?? ""}
                    onChange={() => {}}
                  />
                </div>

                {/* HR_BPM */}
                <div className={[SURFACE_INLINE, "px-3 py-2"].join(" ")}>
                  <div className="text-xs opacity-70 uppercase mb-1">
                    HR_BPM
                  </div>
                  <input
                    type="number"
                    className="bg-gray-800 px-2 py-1 rounded w-full"
                    value={effectiveThr.HR_bpm ?? ""}
                    onChange={(e) =>
                      onThresholdsChange({
                        ...effectiveThr,
                        HR_bpm: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                  />
                </div>

                {/* PACE SEC/KM – zobrazované ako min/km */}
                <div className={[SURFACE_INLINE, "px-3 py-2"].join(" ")}>
                  <div className="text-xs opacity-70 uppercase mb-1">
                    PACE (min/km)
                  </div>
                  <input
                    type="text"
                    className="bg-gray-800 px-2 py-1 rounded w-full"
                    placeholder="4:55"
                    value={secToPaceString(effectiveThr.pace_sec_km)}
                    onChange={(e) =>
                      onThresholdsChange({
                        ...effectiveThr,
                        pace_sec_km: paceStringToSec(e.target.value),
                      })
                    }
                  />
                </div>

                {/* POWER_WATT */}
                <div className={[SURFACE_INLINE, "px-3 py-2"].join(" ")}>
                  <div className="text-xs opacity-70 uppercase mb-1">
                    POWER_WATT
                  </div>
                  <input
                    type="number"
                    className="bg-gray-800 px-2 py-1 rounded w-full"
                    value={effectiveThr.power_watt ?? ""}
                    onChange={(e) =>
                      onThresholdsChange({
                        ...effectiveThr,
                        power_watt: e.target.value
                          ? Number(e.target.value)
                          : null,
                      })
                    }
                  />
                </div>

                {/* MEASUREMENT_TYPE */}
                <div className={[SURFACE_INLINE, "px-3 py-2"].join(" ")}>
                  <div className="text-xs opacity-70 uppercase mb-1">
                    MEASUREMENT_TYPE
                  </div>
                  <select
                    className="bg-gray-800 px-2 py-1 rounded w-full"
                    value={effectiveThr.measurement_type ?? ""}
                    onChange={(e) =>
                      onThresholdsChange({
                        ...effectiveThr,
                        measurement_type: e.target.value,
                      })
                    }
                  >
                    <option value="">(select)</option>
                    {MEAS_TYPE_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {onSaveThresholdsToDB && (
                <button
                  type="button"
                  onClick={async () => {
                    const errs = validateThresholds(effectiveThr);
                    if (errs.length) {
                      console.warn("[THRESHOLDS] Validation failed:", errs);
                      toast.error(errs[0]);
                      return;
                    }
                    console.log("[THRESHOLDS] Saving to DB:", effectiveThr);
                    await onSaveThresholdsToDB(effectiveThr);
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