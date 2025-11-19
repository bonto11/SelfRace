"use client";

import { useEffect, useMemo, useState } from "react";
import { SECTION, SURFACE_INLINE } from "@/shared/ui/classes";
import { InfoPopover } from "@/features/coach/components/InfoPopover";
import SelectField from "@/shared/components/ui/SelectField";
import TextField from "@/shared/components/ui/TextField";
import Button from "@/shared/components/ui/Button";
import DisclosureToggle from "@/shared/components/ui/DisclosureToggle";
import { useUserId } from "@/shared/hooks/useUserId";
import {
  fetchUserThresholdsLatest,
  reduceLatestByCombo,
  debugLogLatestThresholds,
  type UserThresholdRow,
} from "@/features/coach/api/thresholds";
import { toast } from "@/shared/components/ui/Toast";

/* ---------- pace helpers (auto “:”) ---------- */
function formatPace(sec: any): string {
  const n = Number(sec);
  if (!Number.isFinite(n) || n <= 0) return "";
  const m = Math.floor(n / 60);
  const s = n % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
function parsePace(s: string): number | null {
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const mm = Number(m[1]), ss = Number(m[2]);
  if (!Number.isFinite(mm) || !Number.isFinite(ss) || ss > 59) return null;
  return mm * 60 + ss;
}
function maskPaceInput(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 4); // max 4 číslice
  if (d.length <= 2) return d;                   // “05”
  return `${d.slice(0, 2)}:${d.slice(2).padEnd(2, "")}`.slice(0, 5); // “05:”, “05:3”, “05:32”
}

type Props = {
  thresholds: any | undefined;                       // aktuálny draft
  onChange: (t: any) => void;
  onSaveToDB?: (t: any) => Promise<void>;
};

export default function ThresholdsSection({ thresholds, onChange, onSaveToDB }: Props) {
  const { userId } = useUserId();
  const [open, setOpen] = useState(false);
  const [latest, setLatest] = useState<UserThresholdRow[]>([]);

  const thr = thresholds ?? {};
  const [paceText, setPaceText] = useState<string>("");

  // drž lokálny maskovaný text v súlade s číslem v stave
  useEffect(() => { setPaceText(formatPace(thr?.pace_sec_km)); }, [thr?.pace_sec_km]);

  // načítaj latest per combo (a zaloguj)
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      try {
        const rows = await fetchUserThresholdsLatest(userId);
        const reduced = reduceLatestByCombo(rows);
        if (!alive) return;
        setLatest(reduced);
        debugLogLatestThresholds(reduced);
      } catch { /* ticho */ }
    })();
    return () => { alive = false; };
  }, [userId]);

  // odvodené: placeholdery podľa športu
  const isRun = (thr?.sport ?? "running") === "running";

  return (
    <section className={SECTION}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium opacity-90">Thresholds</div>
        <div className="flex items-center gap-2">
          <InfoPopover text="Prahové hodnoty sú viazané na kombináciu Šport × Typ (LT1/LT2/FTP). Do preferencií sa berú posledné hodnoty z DB." />
          <DisclosureToggle open={open} onToggle={() => setOpen((o) => !o)} />
        </div>
      </div>

      {!open && (
        <div className={[SURFACE_INLINE, "px-3 py-2 text-xs opacity-70 select-none"].join(" ")}>
          {thr?.sport ? `${thr.sport} · ${thr.threshold_type ?? "LT2"}` : "—"}{/* stručný náhľad */}
        </div>
      )}

      {open && (
        <div className="space-y-4">
          {/* Sport + Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className={[SURFACE_INLINE, "px-3 py-2"].join(" ")}>
              <SelectField
                label="Sport"
                value={thr.sport ?? "running"}
                onChange={(e) => onChange({ ...thr, sport: e.target.value })}
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
                value={thr.threshold_type ?? "LT2"}
                onChange={(e) => onChange({ ...thr, threshold_type: e.target.value })}
                options={[
                  { value: "LT1", label: "LT1 (aerobic)" },
                  { value: "LT2", label: "LT2 (anaerobic)" },
                  { value: "FTP", label: "FTP (cycling)" },
                ]}
              />
            </div>
          </div>

          {/* HR / Pace / Power */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div className={[SURFACE_INLINE, "px-3 py-2"].join(" ")}>
              <TextField
                label="Threshold HR (bpm)"
                type="number"
                value={thr.hr_bpm ?? ""}
                onChange={(e) => onChange({ ...thr, hr_bpm: e.target.value === "" ? null : Number(e.target.value) })}
              />
            </div>

            <div className={[SURFACE_INLINE, "px-3 py-2"].join(" ")}>
              <TextField
                label={`Threshold pace (${isRun ? "min/km" : "mm:ss"})`}
                value={paceText}
                placeholder="05:30"
                hint="mm:ss (auto „:“ po 2 čísliciach)"
                onChange={(e) => {
                  const masked = maskPaceInput(e.target.value);
                  setPaceText(masked);
                  onChange({ ...thr, pace_sec_km: parsePace(masked) });
                }}
              />
            </div>

            <div className={[SURFACE_INLINE, "px-3 py-2"].join(" ")}>
              <TextField
                label="Threshold power (W)"
                type="number"
                value={thr.power_watt ?? ""}
                onChange={(e) => onChange({ ...thr, power_watt: e.target.value === "" ? null : Number(e.target.value) })}
              />
            </div>
          </div>

          {/* Measurement type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className={[SURFACE_INLINE, "px-3 py-2"].join(" ")}>
              <SelectField
                label="Measurement type"
                value={thr.measurement_type ?? "estimate garmin"}
                onChange={(e) => onChange({ ...thr, measurement_type: e.target.value })}
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
              className="mt-1"
              onClick={async () => {
                // minimalistická validácia
                if (thr.hr_bpm != null && !Number.isFinite(Number(thr.hr_bpm))) {
                  toast.error("HR must be a number"); return;
                }
                await onSaveToDB(thr);
              }}
            >
              Save threshold to DB
            </Button>
          )}

          {/* Latest preview */}
          {latest.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs opacity-70">Aktuálne uložené v DB</div>
              <ul className="flex flex-wrap gap-2">
                {latest.map((r, i) => {
                  const pace = formatPace(r.pace_sec_km);
                  return (
                    <li key={`${r.sport}-${r.threshold_type}-${i}`} className={[SURFACE_INLINE, "px-3 py-1.5 text-xs"].join(" ")}>
                      <span className="font-medium">{r.sport}</span>
                      <span> · {r.threshold_type}</span>
                      {r.hr_bpm ? <span> · HR {Math.round(r.hr_bpm)}</span> : null}
                      {pace ? <span> · {pace}/km</span> : null}
                      {r.power_watt ? <span> · {Math.round(r.power_watt)} W</span> : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}