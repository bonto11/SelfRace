// src/features/coach/components/prefs/ThresholdsSection.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { SECTION, SURFACE_INLINE } from "@/app/shared/ui/classes";
import { InfoPopover } from "@/app/features/coach/components/InfoPopover";
import DisclosureToggle from "@/app/shared/components/ui/DisclosureToggle";
import SelectField from "@/app/shared/components/ui/SelectField";
import TextField from "@/app/shared/components/ui/TextField";
import Button from "@/app/shared/components/ui/Button";
import { toast } from "@/app/shared/components/ui/Toast";

/* ---------- pace helpers (mm:ss) ---------- */
function normalizePaceInput(v: string): string {
  const raw = v.replace(/[^\d:]/g, "");
  if (raw.includes(":")) {
    const [m, s] = raw.split(":");
    return `${m.slice(0, 2)}:${(s ?? "").slice(0, 2)}`;
  }
  if (raw.length <= 2) return raw;
  return `${raw.slice(0, 2)}:${raw.slice(2, 4)}`;
}

function paceToSec(v: string): number | null {
  const t = normalizePaceInput(v);
  if (!t || !t.includes(":")) return null;
  const [m, s] = t.split(":").map((x) => Number(x));
  if (!Number.isFinite(m) || !Number.isFinite(s)) return null;
  return m * 60 + s;
}

function secToPace(n: any): string {
  const s = Number(n);
  if (!Number.isFinite(s) || s <= 0) return "";
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(1, "0")}:${String(r).padStart(2, "0")}`;
}

/* ---------- types ---------- */
type Props = {
  thresholds: any | undefined; // aktuálny draft
  latestList?: any[]; // uložené riadky z DB na preview
  onChange: (t: any) => void;
  onSaveToDB?: (t: any) => Promise<void>;
};

const normalizeSportKey = (s: any): string => {
  const v = String(s || "").toLowerCase();
  if (v === "run") return "running"; // zjednotíme názov
  return v;
};

const makeComboKey = (sport: any, thrType: any): string =>
  `${normalizeSportKey(sport)}|${String(thrType || "").toLowerCase()}`;

/* odporúčané športy */
const THR_SPORTS = [
  { value: "running", label: "Running" },
  { value: "ride", label: "Ride" },
  { value: "swimming", label: "Swimming" },
  { value: "rowing", label: "Rowing" },
  { value: "strength", label: "Strength" },
  { value: "other", label: "Other" },
] as const;

export default function ThresholdsSection({
  thresholds,
  latestList = [],
  onChange,
  onSaveToDB,
}: Props) {
  const t = thresholds ?? {};
  const [open, setOpen] = useState(false);

  const [paceStr, setPaceStr] = useState<string>(secToPace(t.pace_sec_km));
  useEffect(() => {
    setPaceStr(secToPace(t.pace_sec_km));
  }, [t.pace_sec_km]);

  // latestByCombo
  const latestByCombo = useMemo(() => {
    const map = new Map<string, any>();
    for (const r of Array.isArray(latestList) ? latestList : []) {
      const key = makeComboKey(r.sport, r.threshold_type);
      if (!map.has(key)) map.set(key, r);
    }
    return Array.from(map.values());
  }, [latestList]);

  // preview
  const preview = useMemo(() => {
    const key = makeComboKey(t.sport ?? "running", t.threshold_type ?? "LT2");
    const fromLatest = latestByCombo.find(
      (r) => makeComboKey(r.sport, r.threshold_type) === key
    );
    const src = { ...(fromLatest ?? {}), ...t }; // draft má stále prednosť
    return {
      sport: src.sport ?? "running",
      type: src.threshold_type ?? "LT2",
      hr: src.hr_bpm,
      pace: secToPace(src.pace_sec_km),
      pow: src.power_watt,
    };
  }, [t, latestByCombo]);

  return (
    <section className={SECTION}>
      {/* HEADER */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium opacity-90">Thresholds</div>
        <div className="flex items-center gap-2">
          <InfoPopover text="Prahy zadávaj per šport × typ (LT1/LT2/FTP). HR pole je hr_bpm." />
          <DisclosureToggle open={open} onToggle={() => setOpen((o) => !o)} />
        </div>
      </div>

      {/* CLOSED PREVIEW */}
      {!open && (
        <div
          className={[SURFACE_INLINE, "px-3 py-2 text-xs select-none"].join(
            " "
          )}
        >
          <div className="flex flex-wrap gap-4 justify-center">
            <div>
              <span className="opacity-70 mr-1">Sport:</span>
              <span className="font-semibold">{preview.sport}</span>
            </div>
            <div>
              <span className="opacity-70 mr-1">Type:</span>
              <span className="font-semibold">{preview.type}</span>
            </div>
            {preview.hr != null && (
              <div>
                <span className="opacity-70 mr-1">HR:</span>
                <span className="font-semibold">
                  {Math.round(preview.hr)} bpm
                </span>
              </div>
            )}
            {preview.pace && (
              <div>
                <span className="opacity-70 mr-1">Pace:</span>
                <span className="font-semibold">{preview.pace} /km</span>
              </div>
            )}
            {preview.pow != null && (
              <div>
                <span className="opacity-70 mr-1">Power:</span>
                <span className="font-semibold">
                  {Math.round(preview.pow)} W
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* OPEN EDITOR */}
      {open && (
        <>
          {/* sport + type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className={[SURFACE_INLINE, "px-3 py-2"].join(" ")}>
              <SelectField
                label="Sport"
                value={t.sport ?? "running"}
                onChange={(e) => onChange({ ...t, sport: e.target.value })}
                options={THR_SPORTS as any}
              />
            </div>
            <div className={[SURFACE_INLINE, "px-3 py-2"].join(" ")}>
              <SelectField
                label="Threshold type"
                value={t.threshold_type ?? "LT2"}
                onChange={(e) =>
                  onChange({ ...t, threshold_type: e.target.value })
                }
                options={[
                  { value: "LT1", label: "LT1 (aerobic)" },
                  { value: "LT2", label: "LT2 (anaerobic)" },
                  { value: "FTP", label: "FTP (cycling)" },
                ]}
              />
            </div>
          </div>

          {/* HR / Pace / Power */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
            <div className={[SURFACE_INLINE, "px-3 py-2"].join(" ")}>
              <TextField
                label="Threshold HR (bpm)"
                type="number"
                value={t.hr_bpm ?? ""}
                onChange={(e) =>
                  onChange({
                    ...t,
                    hr_bpm:
                      e.target.value === "" ? null : Number(e.target.value),
                  })
                }
              />
            </div>
            <div className={[SURFACE_INLINE, "px-3 py-2"].join(" ")}>
              <TextField
                label="Threshold pace (min/km)"
                value={paceStr}
                placeholder="04:55"
                hint="mm:ss"
                onChange={(e) => {
                  const v = normalizePaceInput(e.target.value);
                  setPaceStr(v);
                  onChange({ ...t, pace_sec_km: paceToSec(v) });
                }}
              />
            </div>
            <div className={[SURFACE_INLINE, "px-3 py-2"].join(" ")}>
              <TextField
                label="Threshold power (W)"
                type="number"
                value={t.power_watt ?? ""}
                onChange={(e) =>
                  onChange({
                    ...t,
                    power_watt:
                      e.target.value === "" ? null : Number(e.target.value),
                  })
                }
              />
            </div>
          </div>

          {/* Measurement */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
            <div className={[SURFACE_INLINE, "px-3 py-2"].join(" ")}>
              <SelectField
                label="Measurement type"
                value={t.measurement_type ?? "estimate garmin"}
                onChange={(e) =>
                  onChange({ ...t, measurement_type: e.target.value })
                }
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

          {onSaveToDB && (
            <Button
              type="button"
              size="sm"
              variant="success"
              className="mt-2"
              onClick={async () => {
                const hrOk =
                  t.hr_bpm == null || Number.isFinite(Number(t.hr_bpm));
                const paceOk =
                  t.pace_sec_km == null ||
                  (Number.isFinite(Number(t.pace_sec_km)) &&
                    Number(t.pace_sec_km) > 0);
                const powOk =
                  t.power_watt == null ||
                  (Number.isFinite(Number(t.power_watt)) &&
                    Number(t.power_watt) > 0);
                if (!hrOk || !paceOk || !powOk) {
                  toast.error("Invalid threshold values");
                  return;
                }
                await onSaveToDB(t);
              }}
            >
              Save threshold to DB
            </Button>
          )}

          {/* uložené v DB */}
          {latestByCombo.length > 0 && (
            <div className="mt-3">
              <div className="text-xs opacity-70 mb-1">
                Aktuálne uložené v DB
              </div>
              <ul className="flex flex-wrap gap-2">
                {latestByCombo.map((r, i) => (
                  <li
                    key={`${r.sport}-${r.threshold_type}-${i}`}
                    className={[SURFACE_INLINE, "px-3 py-1.5 text-xs"].join(
                      " "
                    )}
                  >
                    <span className="font-medium">{r.sport}</span>
                    <span> · {r.threshold_type}</span>
                    {r.hr_bpm ? (
                      <span> · HR {Math.round(r.hr_bpm)}</span>
                    ) : null}
                    {r.pace_sec_km ? (
                      <span> · {secToPace(r.pace_sec_km)} /km</span>
                    ) : null}
                    {r.power_watt ? (
                      <span> · {Math.round(r.power_watt)} W</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
