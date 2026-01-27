// src/features/coach/components/prefs/ZonesSection.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

import InputsCard from "@/app/shared/ui/components/InputsCard";
import SelectField from "@/app/shared/ui/components/SelectField";
import TextField from "@/app/shared/ui/components/TextField";
import Button from "@/app/shared/ui/components/Button";
import { toast } from "@/app/shared/ui/components/Toast";

import { InfoPopover } from "@/app/features/coach/components/InfoPopover";

import {
  SECTION,
  SECTION_STYLE,
  FORM_GRID_TWO,
  INPUTS_CARD_BODY,
  INPUTS_CARD_LABEL_SM_1,
  PANEL_STACK,
  SURFACE_INLINE,
} from "@/app/shared/ui/tokens";

export type ZoneCalcMode = "manual" | "hrmax" | "percent_lthr" | "default";

type Props = {
  zones: any | undefined;
  /** LT2 HR pre aktívny šport (ak je, pre %LTHR výpočet) */
  lthrBpm?: number | null;
  onZonesChange: (z: any) => void;
  onSaveZonesToDB?: (z: any) => Promise<void>;
};

const SPORT_OPTIONS: { value: string; label: string }[] = [
  { value: "running", label: "Running" },
  { value: "ride", label: "Ride" },
  { value: "swimming", label: "Swimming" },
  { value: "rowing", label: "Rowing" },
  { value: "strength", label: "Strength" },
  { value: "other", label: "Other" },
];

const ZONE_KEYS: Array<string> = [
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
  const e: string[] = [];
  for (const k of ZONE_KEYS) {
    if (z[k] == null || Number.isNaN(Number(z[k])))
      e.push(`${String(k)} must be a number`);
  }

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

  if (
    z1_min >= z1_max ||
    z2_min >= z2_max ||
    z3_min >= z3_max ||
    z4_min >= z4_max ||
    z5_min >= z5_max
  ) {
    e.push("Each zone: min < max");
  }

  if (
    !(
      z1_max < z2_min &&
      z2_max <= z3_min &&
      z3_max <= z4_min &&
      z4_max <= z5_min
    )
  ) {
    e.push("Zones must be ordered");
  }

  if (hr_max && z5_max > hr_max) e.push(`Z5 max ≤ HRmax (${hr_max})`);
  return e;
}

function recalc(mode: ZoneCalcMode, z: any, lthrBpm?: number | null) {
  if (!z || mode === "manual") return { ...z };
  const out = { ...z };
  const h = Number(z.hr_max) || 200;

  if (mode === "hrmax" || mode === "default") {
    out.z1_min = Math.round(h * 0.5);
    out.z1_max = Math.round(h * 0.6);
    out.z2_min = Math.round(h * 0.6) + 1;
    out.z2_max = Math.round(h * 0.7);
    out.z3_min = Math.round(h * 0.7) + 1;
    out.z3_max = Math.round(h * 0.8);
    out.z4_min = Math.round(h * 0.8) + 1;
    out.z4_max = Math.round(h * 0.9);
    out.z5_min = Math.round(h * 0.9) + 1;
    out.z5_max = h;
    return out;
  }

  if (mode === "percent_lthr" && Number.isFinite(Number(lthrBpm))) {
    const L = Number(lthrBpm);
    out.z1_max = Math.round(L * 0.81);
    out.z1_min = Math.round(L * 0.65);
    out.z2_max = Math.round(L * 0.89);
    out.z2_min = out.z1_max + 1;
    out.z3_max = Math.round(L * 0.93);
    out.z3_min = out.z2_max + 1;
    out.z4_max = Math.round(L * 0.99);
    out.z4_min = out.z3_max + 1;
    out.z5_min = out.z4_max + 1;
    out.z5_max = h;
    return out;
  }

  return out;
}

export default function ZonesSection({
  zones,
  lthrBpm,
  onZonesChange,
  onSaveZonesToDB,
}: Props) {
  const [open, setOpen] = useState(false);
  const [calcMode, setCalcMode] = useState<ZoneCalcMode>("manual");

  const z = useMemo(
    () => ({
      sport: zones?.sport ?? "running",
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

  const zonesLocked = calcMode !== "manual";

  const fmtRange = (a: any, b: any) =>
    Number.isFinite(Number(a)) && Number.isFinite(Number(b))
      ? `${Number(a)}–${Number(b)} bpm`
      : "—";

  const previewNode = (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-3">
      <div>
        <span className="opacity-70 mr-1">Aerobic (Z2):</span>
        <span className="font-semibold">{fmtRange(z.z2_min, z.z2_max)}</span>
      </div>
      <div>
        <span className="opacity-70 mr-1">Anaerobic (Z4):</span>
        <span className="font-semibold">{fmtRange(z.z4_min, z.z4_max)}</span>
      </div>
      <div>
        <span className="opacity-70 mr-1">HRmax:</span>
        <span className="font-semibold">
          {z.hr_max != null && Number.isFinite(Number(z.hr_max))
            ? `${Number(z.hr_max)} bpm`
            : "—"}
        </span>
      </div>
    </div>
  );

  // automatický prepočet pri zmene režimu/HRmax/LTHR/sport
  useEffect(() => {
    if (!zones) return;
    onZonesChange(
      recalc(calcMode, { ...(zones ?? {}), sport: z.sport }, lthrBpm)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calcMode, zones?.hr_max, lthrBpm, z.sport]);

  return (
    <InputsCard
      title={
        <div className="flex items-center gap-2">
          <span>Heart-rate zones</span>
          <InfoPopover text="Zóny podľa HRmax alebo %LTHR. Šport sa ukladá k záznamu." />
        </div>
      }
      subtitle="Výpočet zón (manual / HRmax / %LTHR) + uloženie do DB."
      preview={previewNode}
      open={open}
      onOpenChange={setOpen}
    >
      <div className={[INPUTS_CARD_BODY, PANEL_STACK].join(" ")}>
        {/* sport + calc + HRmax + LTHR */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <section className={SECTION} style={SECTION_STYLE}>
            <div className={INPUTS_CARD_LABEL_SM_1}>Sport</div>
            <SelectField
              label=""
              value={z.sport}
              onChange={(e) =>
                onZonesChange({ ...(zones ?? {}), sport: e.target.value })
              }
              options={SPORT_OPTIONS}
              hint=""
            />
          </section>

          <section className={SECTION} style={SECTION_STYLE}>
            <div className={INPUTS_CARD_LABEL_SM_1}>Zone calculation</div>
            <SelectField
              label=""
              value={calcMode}
              onChange={(e) => setCalcMode(e.target.value as ZoneCalcMode)}
              options={[
                { value: "manual", label: "Manual" },
                { value: "hrmax", label: "From HRmax (%)" },
                { value: "percent_lthr", label: "From % LTHR" },
                { value: "default", label: "Internal default" },
              ]}
              hint={
                calcMode === "percent_lthr" && !Number.isFinite(Number(lthrBpm))
                  ? "Zadaj LT2 HR v Thresholds pre tento šport."
                  : undefined
              }
            />
          </section>

          <section className={SECTION} style={SECTION_STYLE}>
            <div className={INPUTS_CARD_LABEL_SM_1}>HRmax (bpm)</div>
            <TextField
              label=""
              type="number"
              value={z.hr_max ?? ""}
              onChange={(e) => {
                const val = e.target.value ? Number(e.target.value) : null;
                const next = { ...(zones ?? {}), sport: z.sport, hr_max: val };
                onZonesChange(
                  calcMode === "manual" ? next : recalc(calcMode, next, lthrBpm)
                );
              }}
            />
          </section>

          <section className={SECTION} style={SECTION_STYLE}>
            <div className={INPUTS_CARD_LABEL_SM_1}>LTHR (bpm)</div>
            <TextField
              label=""
              value={Number.isFinite(Number(lthrBpm)) ? String(lthrBpm) : ""}
              disabled
              hint="Zdroj: Thresholds (LT2 HR)"
            />
          </section>
        </div>

        {/* zones */}
        <div className={INPUTS_CARD_LABEL_SM_1}>Zones (bpm)</div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {(["z1", "z2", "z3", "z4", "z5"] as const).map((key) => {
            const minKey = `${key}_min` as const;
            const maxKey = `${key}_max` as const;

            return (
              <div
                key={key}
                className={[SURFACE_INLINE, "px-3 py-2"].join(" ")}
              >
                <div className="text-xs opacity-70 uppercase mb-1">
                  {key.toUpperCase()}
                </div>
                <div className="flex items-center gap-2">
                  <TextField
                    label=""
                    type="number"
                    disabled={zonesLocked}
                    className="w-20 disabled:opacity-40"
                    value={(z as any)[minKey] ?? ""}
                    onChange={(e) =>
                      onZonesChange({
                        ...(zones ?? {}),
                        sport: z.sport,
                        [minKey]: e.target.value
                          ? Number(e.target.value)
                          : null,
                      })
                    }
                  />
                  <span className="opacity-60">–</span>
                  <TextField
                    label=""
                    type="number"
                    disabled={zonesLocked}
                    className="w-20 disabled:opacity-40"
                    value={(z as any)[maxKey] ?? ""}
                    onChange={(e) =>
                      onZonesChange({
                        ...(zones ?? {}),
                        sport: z.sport,
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

        {onSaveZonesToDB ? (
          <div className="pt-1">
            <Button
              type="button"
              size="sm"
              variant="success"
              onClick={async () => {
                const payload = { ...(zones ?? {}), ...z };
                const errs = validateZones(payload);
                if (errs.length) {
                  toast.error(errs[0]);
                  return;
                }
                await onSaveZonesToDB(payload);
              }}
            >
              Save zones to DB
            </Button>
          </div>
        ) : null}
      </div>
    </InputsCard>
  );
}
