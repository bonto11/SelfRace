// src/features/coach/components/prefs/ThresholdsSection.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { SECTION, SURFACE_INLINE } from "@/shared/ui/classes";
import SelectField from "@/shared/components/ui/SelectField";
import TextField from "@/shared/components/ui/TextField";
import Button from "@/shared/components/ui/Button";
import { toast } from "@/shared/components/ui/Toast";

// mm:ss helper – doplní ":" po 2 cifrách
function normalizePaceInput(v: string): string {
  const raw = v.replace(/[^\d:]/g, "");
  if (raw.includes(":")) return raw.split(":").slice(0, 2).map((p,i)=> i===0?p.slice(0,2):p.slice(0,2)).join(":");
  if (raw.length <= 2) return raw;
  return `${raw.slice(0,2)}:${raw.slice(2,4)}`;
}
function paceToSec(v: string): number | null {
  const t = normalizePaceInput(v);
  if (!t || !t.includes(":")) return null;
  const [m,s] = t.split(":").map((x) => Number(x));
  if (!Number.isFinite(m) || !Number.isFinite(s)) return null;
  return m*60 + s;
}
function secToPace(n: any): string {
  const s = Number(n);
  if (!Number.isFinite(s) || s <= 0) return "";
  const m = Math.floor(s/60), r = s%60;
  return `${String(m).padStart(1,"0")}:${String(r).padStart(2,"0")}`;
}

type Props = {
  thresholds: any | undefined;        // draft
  latestList?: any[];                 // surové uložené riadky (na preview)
  onChange: (t: any) => void;
  onSaveToDB?: (t: any) => Promise<void>;
};

export default function ThresholdsSection({ thresholds, latestList = [], onChange, onSaveToDB }: Props) {
  const t = thresholds ?? {};
  const [paceStr, setPaceStr] = useState<string>(secToPace(t.pace_sec_km));

  useEffect(() => { setPaceStr(secToPace(t.pace_sec_km)); }, [t.pace_sec_km]);

  const latestByCombo = useMemo(() => {
    const map = new Map<string, any>();
    const rows = Array.isArray(latestList) ? latestList : [];
    // očakávame z BE zoradené od najnovších; prvý výskyt kombo = latest
    for (const r of rows) {
      const key = `${r.sport}|${r.threshold_type}`.toLowerCase();
      if (!map.has(key)) map.set(key, r);
    }
    return Array.from(map.values());
  }, [latestList]);

  return (
    <section className={SECTION}>
      <div className="text-sm font-medium opacity-90 mb-2">Thresholds</div>

      {/* sport + type */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className={[SURFACE_INLINE, "px-3 py-2"].join(" ")}>
          <SelectField
            label="Sport"
            value={t.sport ?? "running"}
            onChange={(e) => onChange({ ...t, sport: e.target.value })}
            options={[
              { value: "running", label: "Running" },
              { value: "cycling", label: "Cycling" },
              { value: "other", label: "Other" },
            ]}
          />
        </div>
        <div className={[SURFACE_INLINE, "px-3 py-2"].join(" ")}>
          <SelectField
            label="Threshold type"
            value={t.threshold_type ?? "LT2"}
            onChange={(e) => onChange({ ...t, threshold_type: e.target.value })}
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
            value={t.HR_bpm ?? ""}
            onChange={(e) => onChange({ ...t, HR_bpm: e.target.value === "" ? null : Number(e.target.value) })}
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
            onChange={(e) => onChange({ ...t, power_watt: e.target.value === "" ? null : Number(e.target.value) })}
          />
        </div>
      </div>

      {/* Measurement */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
        <div className={[SURFACE_INLINE, "px-3 py-2"].join(" ")}>
          <SelectField
            label="Measurement type"
            value={t.measurement_type ?? "estimate garmin"}
            onChange={(e) => onChange({ ...t, measurement_type: e.target.value })}
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
          type="button" size="sm" variant="success" className="mt-2"
          onClick={async () => {
            // basic valida
            const hrOk = t.HR_bpm == null || Number.isFinite(Number(t.HR_bpm));
            const paceOk = t.pace_sec_km == null || (Number.isFinite(Number(t.pace_sec_km)) && Number(t.pace_sec_km) > 0);
            const powOk = t.power_watt == null || (Number.isFinite(Number(t.power_watt)) && Number(t.power_watt) > 0);
            if (!hrOk || !paceOk || !powOk) { toast.error("Invalid threshold values"); return; }
            await onSaveToDB(t);
          }}
        >
          Save threshold to DB
        </Button>
      )}

      {/* Aktuálne uložené v DB */}
      {latestByCombo.length > 0 && (
        <div className="mt-3">
          <div className="text-xs opacity-70 mb-1">Aktuálne uložené v DB</div>
          <ul className="flex flex-wrap gap-2">
            {latestByCombo.map((r, i) => (
              <li key={`${r.sport}-${r.threshold_type}-${i}`} className={[SURFACE_INLINE, "px-3 py-1.5 text-xs"].join(" ")}>
                <span className="font-medium">{r.sport}</span>
                <span> · {r.threshold_type}</span>
                {r.hr_bpm ? <span> · HR {Math.round(r.hr_bpm)}</span> : null}
                {r.pace_sec_km ? <span> · {secToPace(r.pace_sec_km)} /km</span> : null}
                {r.power_watt ? <span> · {Math.round(r.power_watt)} W</span> : null}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}