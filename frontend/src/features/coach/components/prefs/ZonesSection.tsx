// src/features/coach/components/ZonesSection.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { SECTION, SURFACE_INLINE } from "@/shared/ui/classes";
import { InfoPopover } from "@/features/coach/components/InfoPopover";
import { toast } from "@/shared/components/ui/Toast";

import TextField from "@/shared/components/ui/TextField";
import Button from "@/shared/components/ui/Button";
import SelectField from "@/shared/components/ui/SelectField";
import DisclosureToggle from "@/shared/components/ui/DisclosureToggle";

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

const ZONE_KEYS: Array<keyof any> = [
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
      errors.push(`Field ${String(key)} must be a number (got ${v ?? "empty"})`);
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
    if (min >= max) errors.push(`${label}: min must be < max (${min} vs ${max})`);
  }

  if (!(z1_max < z2_min && z2_max <= z3_min && z3_max <= z4_min && z4_max <= z5_min)) {
    errors.push("Zones should be ordered and non-overlapping (Z1 < Z2 < Z3 < Z4 < Z5).");
  }

  if (hr_max && z5_max > hr_max) {
    errors.push(`Z5 max (${z5_max}) must be ≤ HRmax (${hr_max}).`);
  }

  return errors;
}

/* ---------------- THRESHOLDS VALIDATION + HELPERS ---------------- */

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

// seconds -> "mm:ss"
function formatPace(sec: any): string {
  const n = Number(sec);
  if (!Number.isFinite(n) || n <= 0) return "";
  const m = Math.floor(n / 60);
  const s = n % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// "mm:ss" -> seconds (int)
function parsePace(str: string): number | null {
  const raw = str.trim();
  if (!raw) return null;
  if (raw.includes(":")) {
    const [mStr, sStr] = raw.split(":");
    const m = Number(mStr);
    const s = Number(sStr);
    if (!Number.isFinite(m) || !Number.isFinite(s)) return null;
    return m * 60 + s;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

/* ---------------- RE-CALC ---------------- */

function recalcZones(mode: ZoneCalcMode, z: any, thr: any) {
  if (!z) return z;

  const out = { ...z };
  const hrmax = Number(z.hr_max) || 200;
  const lthr = thr?.HR_bpm ? Number(thr.HR_bpm) : null;

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

  if (mode === "percent_lthr") {
    if (!lthr) return out;
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

  // default = HRmax fallback
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

  // vždy zobraz polia – aj bez dát z DB
  const z = useMemo(
    () => ({
      hr_max: zones?.hr_max ?? null,
      z1_min: zones?.z1_min ?? null,
      z1_max: zones?.z1_max ?? null,
      z2_min: zones?.z2_min ?? null,
      z2_max: zones?.z2_max ?? null,
      z3_min: zones?.z3_min ?? null,
      z3_max: zones?.z3_max ?? null,
      z4_min: zones?.z4_min ?? null,
      z4_max: zones?.z4_max ?? null,
      z5_min: zones?.z5_min ?? null,
      z5_max: zones?.z5_max ?? null,
    }),
    [zones]
  );

  const thr = thresholds ?? {};
  const paceDisplay = formatPace(thr.pace_sec_km);
  const zonesLocked = calcMode !== "manual";

  // Recalc pri zmene módu / HRmax / LTHR (len keď nie je manual)
  useEffect(() => {
    if (!zones) return;
    if (calcMode === "manual") return;
    const next = recalcZones(calcMode, zones, thresholds);
    if (next) onZonesChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calcMode, zones?.hr_max, thresholds?.HR_bpm]);

  return (
    <section className={SECTION}>
      {/* HEADER */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium opacity-90">Heart-rate zones & thresholds</div>
        <div className="flex items-center gap-2">
          <InfoPopover text="Výpočet zón podľa HRmax, %LTHR alebo manuálne. LTHR sa edituje v Thresholds." />
          <DisclosureToggle open={open} onToggle={() => setOpen((o) => !o)} />
        </div>
      </div>

      {/* CLOSED PREVIEW */}
      {!open && (
        <div className={[SURFACE_INLINE, "px-3 py-2 text-xs opacity-70 select-none"].join(" ")}>
          Zóny a prahy – klikni na šípku pre zobrazenie.
        </div>
      )}

      {/* OPEN CONTENT */}
      {open && (
        <div className="space-y-5">
          {/* MODE + HRmax + LTHR (read-only) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className={[SURFACE_INLINE, "px-3 py-2"].join(" ")}>
              <SelectField
                label="Zone calculation"
                value={calcMode}
                onChange={(e) => setCalcMode(e.target.value as ZoneCalcMode)}
                options={[
                  { value: "manual", label: "Manual (test/custom)" },
                  { value: "hrmax", label: "From HRmax (%)" },
                  { value: "percent_lthr", label: "From % LTHR" },
                  { value: "default", label: "Internal default" },
                ]}
                hint={
                  calcMode === "percent_lthr" && !thresholds?.HR_bpm
                    ? "Set LTHR in Thresholds to enable accurate %LTHR calc."
                    : undefined
                }
              />
            </div>

            <div className={[SURFACE_INLINE, "px-3 py-2"].join(" ")}>
              <TextField
                label="HRmax (bpm)"
                type="number"
                value={z.hr_max ?? ""}
                onChange={(e) => {
                  const val = e.target.value ? Number(e.target.value) : null;
                  const next = { ...(zones ?? {}), hr_max: val };
                  onZonesChange(next);
                  if (calcMode !== "manual") {
                    const recalc = recalcZones(calcMode, next, thresholds);
                    if (recalc) onZonesChange(recalc);
                  }
                }}
              />
            </div>

            <div className={[SURFACE_INLINE, "px-3 py-2"].join(" ")}>
              <TextField
                label="LTHR (bpm)"
                value={thresholds?.HR_bpm ?? ""}
                disabled
                hint="Edituj v sekcii Thresholds"
              />
            </div>
          </div>

          {/* ZONES EDITOR – vždy viditeľné, uzamknuté mimo manual */}
          <div className="text-xs opacity-70">Zones (bpm)</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(["z1", "z2", "z3", "z4", "z5"] as const).map((key) => {
              const minKey = `${key}_min` as const;
              const maxKey = `${key}_max` as const;
              return (
                <div key={key} className={[SURFACE_INLINE, "px-3 py-2"].join(" ")}>
                  <div className="text-xs opacity-70 uppercase mb-1">{key.toUpperCase()}</div>
                  <div className="flex items-center gap-2">
                    <TextField
                      type="number"
                      disabled={zonesLocked}
                      className="w-20 disabled:opacity-40"
                      value={z[minKey] ?? ""}
                      onChange={(e) =>
                        onZonesChange({
                          ...(zones ?? {}),
                          [minKey]: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                    />
                    <span className="opacity-60">–</span>
                    <TextField
                      type="number"
                      disabled={zonesLocked}
                      className="w-20 disabled:opacity-40"
                      value={z[maxKey] ?? ""}
                      onChange={(e) =>
                        onZonesChange({
                          ...(zones ?? {}),
                          [maxKey]: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {onSaveZonesToDB && (
            <Button
              type="button"
              size="sm"
              variant="success"
              className="mt-2"
              onClick={async () => {
                const errs = validateZones({ ...(zones ?? {}), ...z });
                if (errs.length) {
                  console.warn("[ZONES] Validation failed:", errs);
                  toast.error(errs[0]);
                  return;
                }
                await onSaveZonesToDB({ ...(zones ?? {}), ...z });
              }}
            >
              Save zones to DB
            </Button>
          )}

          {/* THRESHOLDS */}
          <div className="text-xs opacity-70">Thresholds</div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {/* SPORT */}
            <div className={[SURFACE_INLINE, "px-3 py-2"].join(" ")}>
              <SelectField
                label="Sport"
                value={thr.sport ?? "running"}
                onChange={(e) => onThresholdsChange({ ...thr, sport: e.target.value })}
                options={[
                  { value: "running", label: "Running" },
                  { value: "cycling", label: "Cycling" },
                  { value: "other", label: "Other" },
                ]}
              />
            </div>

            {/* THRESHOLD TYPE */}
            <div className={[SURFACE_INLINE, "px-3 py-2"].join(" ")}>
              <SelectField
                label="Threshold type"
                value={thr.threshold_type ?? "LT2"}
                onChange={(e) => onThresholdsChange({ ...thr, threshold_type: e.target.value })}
                options={[
                  { value: "LT1", label: "LT1 (aerobic)" },
                  { value: "LT2", label: "LT2 (anaerobic)" },
                  { value: "FTP", label: "FTP (cycling)" },
                  { value: "HR_LT2", label: "HR at LT2" },
                  { value: "PACE_LT2", label: "Pace at LT2" },
                ]}
              />
            </div>

            {/* UPDATED AT – read-only */}
            <div className={[SURFACE_INLINE, "px-3 py-2"].join(" ")}>
              <TextField label="Updated at" value={thr.updated_at ?? ""} disabled hint="Read-only" />
            </div>

            {/* HR_bpm */}
            <div className={[SURFACE_INLINE, "px-3 py-2"].join(" ")}>
              <TextField
                label="Threshold HR (bpm)"
                type="number"
                value={thr.HR_bpm ?? ""}
                onChange={(e) =>
                  onThresholdsChange({
                    ...thr,
                    HR_bpm: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
              />
            </div>

            {/* PACE – min/km -> pace_sec_km */}
            <div className={[SURFACE_INLINE, "px-3 py-2"].join(" ")}>
              <TextField
                label="Threshold pace (min/km)"
                value={paceDisplay}
                placeholder="4:55"
                hint="Formát mm:ss – napr. 4:55"
                onChange={(e) => {
                  const seconds = parsePace(e.target.value);
                  onThresholdsChange({ ...thr, pace_sec_km: seconds });
                }}
              />
            </div>

            {/* POWER WATT */}
            <div className={[SURFACE_INLINE, "px-3 py-2"].join(" ")}>
              <TextField
                label="Threshold power (W)"
                type="number"
                value={thr.power_watt ?? ""}
                onChange={(e) =>
                  onThresholdsChange({
                    ...thr,
                    power_watt: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
              />
            </div>

            {/* MEASUREMENT TYPE */}
            <div className={[SURFACE_INLINE, "px-3 py-2"].join(" ")}>
              <SelectField
                label="Measurement type"
                value={thr.measurement_type ?? "estimate garmin"}
                onChange={(e) => onThresholdsChange({ ...thr, measurement_type: e.target.value })}
                options={[
                  { value: "lab test", label: "Lab test" },
                  { value: "field test", label: "Field test" },
                  { value: "estimate garmin", label: "Estimate – Garmin" },
                  { value: "estimate strava", label: "Estimate – Strava" },
                  { value: "coach estimate", label: "Coach estimate" },
                  { value: "other", label: "Other" },
                ]}
              />
            </div>
          </div>

          {onSaveThresholdsToDB && (
            <Button
              type="button"
              size="sm"
              variant="success"
              className="mt-2"
              onClick={async () => {
                const errs = validateThresholds(thr);
                if (errs.length) {
                  console.warn("[THRESHOLDS] Validation failed:", errs);
                  toast.error(errs[0]);
                  return;
                }
                await onSaveThresholdsToDB(thr);
              }}
            >
              Save thresholds to DB
            </Button>
          )}
        </div>
      )}
    </section>
  );
}