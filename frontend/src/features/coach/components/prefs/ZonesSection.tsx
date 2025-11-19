"use client";

import { useEffect, useMemo, useState } from "react";
import { SECTION, SURFACE_INLINE } from "@/shared/ui/classes";
import { InfoPopover } from "@/features/coach/components/InfoPopover";
import DisclosureToggle from "@/shared/components/ui/DisclosureToggle";
import SelectField from "@/shared/components/ui/SelectField";
import TextField from "@/shared/components/ui/TextField";
import Button from "@/shared/components/ui/Button";
import { toast } from "@/shared/components/ui/Toast";

export type ZoneCalcMode = "manual" | "hrmax" | "percent_lthr" | "default";

type Props = {
  zones: any | undefined;
  onZonesChange: (z: any) => void;
  onSaveZonesToDB?: (z: any) => Promise<void>;
};

const ZONE_KEYS: Array<keyof any> = [
  "z1_min","z1_max","z2_min","z2_max","z3_min","z3_max","z4_min","z4_max","z5_min","z5_max",
];

function validateZones(z: any): string[] {
  if (!z) return ["Zones payload is empty"];
  const e: string[] = [];
  for (const k of ZONE_KEYS) if (z[k] == null || Number.isNaN(Number(z[k]))) e.push(`${String(k)} must be a number`);
  const { z1_min,z1_max,z2_min,z2_max,z3_min,z3_max,z4_min,z4_max,z5_min,z5_max,hr_max } = z as Record<string, number>;
  if (z1_min >= z1_max || z2_min >= z2_max || z3_min >= z3_max || z4_min >= z4_max || z5_min >= z5_max) e.push("Each zone: min < max");
  if (!(z1_max < z2_min && z2_max <= z3_min && z3_max <= z4_min && z4_max <= z5_min)) e.push("Zones must be ordered");
  if (hr_max && z5_max > hr_max) e.push(`Z5 max ≤ HRmax (${hr_max})`);
  return e;
}

function recalc(mode: ZoneCalcMode, z: any) {
  if (!z || mode === "manual") return { ...z };
  const out = { ...z };
  const h = Number(z.hr_max) || 200;
  if (mode === "hrmax" || mode === "default") {
    out.z1_min = Math.round(h * 0.5); out.z1_max = Math.round(h * 0.6);
    out.z2_min = Math.round(h * 0.6); out.z2_max = Math.round(h * 0.7);
    out.z3_min = Math.round(h * 0.7); out.z3_max = Math.round(h * 0.8);
    out.z4_min = Math.round(h * 0.8); out.z4_max = Math.round(h * 0.9);
    out.z5_min = Math.round(h * 0.9); out.z5_max = h;
  }
  return out;
}

export default function ZonesSection({ zones, onZonesChange, onSaveZonesToDB }: Props) {
  const [open, setOpen] = useState(false);
  const [calcMode, setCalcMode] = useState<ZoneCalcMode>("manual");

  const z = useMemo(
    () => ({
      hr_max: zones?.hr_max ?? null,
      z1_min: zones?.z1_min ?? null, z1_max: zones?.z1_max ?? null,
      z2_min: zones?.z2_min ?? null, z2_max: zones?.z2_max ?? null,
      z3_min: zones?.z3_min ?? null, z3_max: zones?.z3_max ?? null,
      z4_min: zones?.z4_min ?? null, z4_max: zones?.z4_max ?? null,
      z5_min: zones?.z5_min ?? null, z5_max: zones?.z5_max ?? null,
    }),
    [zones]
  );

  const zonesLocked = calcMode !== "manual";
  const fmtRange = (a: any, b: any) =>
    Number.isFinite(Number(a)) && Number.isFinite(Number(b)) ? `${Number(a)}–${Number(b)} bpm` : "—";
  const previewZ2 = fmtRange(z.z2_min, z.z2_max);
  const previewZ4 = fmtRange(z.z4_min, z.z4_max);
  const previewHRM = z.hr_max != null && Number.isFinite(Number(z.hr_max)) ? `${Number(z.hr_max)} bpm` : "—";

  useEffect(() => {
    if (!zones || calcMode === "manual") return;
    onZonesChange(recalc(calcMode, zones));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calcMode, zones?.hr_max]);

  return (
    <section className={SECTION}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium opacity-90">Heart-rate zones</div>
        <div className="flex items-center gap-2">
          <InfoPopover text="Zóny podľa HRmax alebo manuálne." />
          <DisclosureToggle open={open} onToggle={() => setOpen((o) => !o)} />
        </div>
      </div>

      {!open && (
        <div className={[SURFACE_INLINE, "px-3 py-2 text-xs select-none"].join(" ")}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-3 text-center">
            <div><span className="opacity-70 mr-1">Aerobic (Z2):</span><span className="font-semibold">{previewZ2}</span></div>
            <div><span className="opacity-70 mr-1">Anaerobic (Z4):</span><span className="font-semibold">{previewZ4}</span></div>
            <div><span className="opacity-70 mr-1">HRmax:</span><span className="font-semibold">{previewHRM}</span></div>
          </div>
        </div>
      )}

      {open && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className={[SURFACE_INLINE, "px-3 py-2"].join(" ")}>
              <SelectField
                label="Zone calculation"
                value={calcMode}
                onChange={(e) => setCalcMode(e.target.value as ZoneCalcMode)}
                options={[
                  { value: "manual", label: "Manual" },
                  { value: "hrmax", label: "From HRmax (%)" },
                  { value: "default", label: "Internal default" },
                ]}
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
                  onZonesChange(calcMode === "manual" ? next : recalc(calcMode, next));
                }}
              />
            </div>
          </div>

          <div className="text-xs opacity-70">Zones (bpm)</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(["z1","z2","z3","z4","z5"] as const).map((key) => {
              const minKey = `${key}_min` as const, maxKey = `${key}_max` as const;
              return (
                <div key={key} className={[SURFACE_INLINE, "px-3 py-2"].join(" ")}>
                  <div className="text-xs opacity-70 uppercase mb-1">{key.toUpperCase()}</div>
                  <div className="flex items-center gap-2">
                    <TextField
                      type="number"
                      disabled={zonesLocked}
                      className="w-20 disabled:opacity-40"
                      value={z[minKey] ?? ""}
                      onChange={(e) => onZonesChange({ ...(zones ?? {}), [minKey]: e.target.value ? Number(e.target.value) : null })}
                    />
                    <span className="opacity-60">–</span>
                    <TextField
                      type="number"
                      disabled={zonesLocked}
                      className="w-20 disabled:opacity-40"
                      value={z[maxKey] ?? ""}
                      onChange={(e) => onZonesChange({ ...(zones ?? {}), [maxKey]: e.target.value ? Number(e.target.value) : null })}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {onSaveZonesToDB && (
            <Button
              type="button" size="sm" variant="success" className="mt-1"
              onClick={async () => {
                const errs = validateZones({ ...(zones ?? {}), ...z });
                if (errs.length) { toast.error(errs[0]); return; }
                await onSaveZonesToDB({ ...(zones ?? {}), ...z });
              }}
            >
              Save zones to DB
            </Button>
          )}
        </div>
      )}
    </section>
  );
}