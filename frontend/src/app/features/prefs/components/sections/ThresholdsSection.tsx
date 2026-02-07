// src/features/coach/components/prefs/ThresholdsSection.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

import InputsCard from "@/app/shared/ui/components/InputsCard";
import SelectField from "@/app/shared/ui/components/SelectField";
import TextField from "@/app/shared/ui/components/TextField";
import Button from "@/app/shared/ui/components/Button";
import { toast } from "@/app/shared/ui/components/Toast";

import { TooltipIcon } from "@/app/shared/ui/components/Tooltip";

import {
  SECTION,
  SECTION_STYLE,
  FORM_GRID_TWO,
  PANEL_STACK,
  INPUTS_CARD_BODY,
  INPUTS_CARD_LABEL_SM_1,
} from "@/app/shared/ui/tokens";

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
      (r) => makeComboKey(r.sport, r.threshold_type) === key,
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

  const previewNode = (
    <div className="flex flex-wrap gap-4">
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
          <span className="font-semibold">{Math.round(preview.hr)} bpm</span>
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
          <span className="font-semibold">{Math.round(preview.pow)} W</span>
        </div>
      )}
    </div>
  );

  const handleSaveToDB = async () => {
    if (!onSaveToDB) return;

    const hrOk = t.hr_bpm == null || Number.isFinite(Number(t.hr_bpm));
    const paceOk =
      t.pace_sec_km == null ||
      (Number.isFinite(Number(t.pace_sec_km)) && Number(t.pace_sec_km) > 0);
    const powOk =
      t.power_watt == null ||
      (Number.isFinite(Number(t.power_watt)) && Number(t.power_watt) > 0);

    if (!hrOk || !paceOk || !powOk) {
      toast.error("Invalid threshold values");
      return;
    }

    await onSaveToDB(t);
  };

  return (
    <InputsCard
      title={
        <div className="flex items-center gap-2">
          <span>Thresholds</span>
          <TooltipIcon text="Prahy zadávaj per šport × typ (LT1/LT2/FTP).\n\nHR pole je hr_bpm." />
        </div>
      }
      subtitle="Prahy pre zóny a intenzity (draft + uložené z DB)."
      preview={previewNode}
      open={open}
      onOpenChange={setOpen}
      actions={
        onSaveToDB ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={handleSaveToDB}
          >
            Save threshold to DB
          </Button>
        ) : null
      }
    >
      <div className={[INPUTS_CARD_BODY, PANEL_STACK].join(" ")}>
        {/* sport + type */}
        <div className={FORM_GRID_TWO}>
          <section className={SECTION} style={SECTION_STYLE}>
            <div className={INPUTS_CARD_LABEL_SM_1}>Sport</div>
            <SelectField
              value={t.sport ?? "running"}
              onChange={(e) => onChange({ ...t, sport: e.target.value })}
              options={THR_SPORTS as any}
            />
          </section>

          <section className={SECTION} style={SECTION_STYLE}>
            <div className={INPUTS_CARD_LABEL_SM_1}>Threshold type</div>
            <SelectField
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
          </section>
        </div>

        {/* HR / Pace / Power */}
        <div className={FORM_GRID_TWO}>
          <section className={SECTION} style={SECTION_STYLE}>
            <div className={INPUTS_CARD_LABEL_SM_1}>Threshold HR</div>
            <TextField
              type="number"
              inputMode="numeric"
              value={t.hr_bpm ?? ""}
              onChange={(e) =>
                onChange({
                  ...t,
                  hr_bpm: e.target.value === "" ? null : Number(e.target.value),
                })
              }
              placeholder="bpm"
            />
          </section>

          <section className={SECTION} style={SECTION_STYLE}>
            <div className={INPUTS_CARD_LABEL_SM_1}>Threshold pace</div>
            <TextField
              value={paceStr}
              placeholder="04:55"
              hint="mm:ss /km"
              onChange={(e) => {
                const v = normalizePaceInput(e.target.value);
                setPaceStr(v);
                onChange({ ...t, pace_sec_km: paceToSec(v) });
              }}
            />
          </section>

          <section className={SECTION} style={SECTION_STYLE}>
            <div className={INPUTS_CARD_LABEL_SM_1}>Threshold power</div>
            <TextField
              type="number"
              inputMode="numeric"
              value={t.power_watt ?? ""}
              onChange={(e) =>
                onChange({
                  ...t,
                  power_watt:
                    e.target.value === "" ? null : Number(e.target.value),
                })
              }
              placeholder="W"
            />
          </section>

          <section className={SECTION} style={SECTION_STYLE}>
            <div className={INPUTS_CARD_LABEL_SM_1}>Measurement type</div>
            <SelectField
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
          </section>
        </div>

        {/* uložené v DB */}
        {latestByCombo.length > 0 && (
          <div className="mt-1">
            <div className="flex items-center gap-2">
              <div className={INPUTS_CARD_LABEL_SM_1}>Aktuálne uložené v DB</div>
              <TooltipIcon text="Zobrazuje posledný uložený záznam pre každú kombináciu šport × typ prahu." />
            </div>

            <ul className="mt-2 flex flex-wrap gap-2">
              {latestByCombo.map((r, i) => (
                <li
                  key={`${r.sport}-${r.threshold_type}-${i}`}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs"
                >
                  <span className="font-medium">{r.sport}</span>
                  <span> · {r.threshold_type}</span>
                  {r.hr_bpm ? <span> · HR {Math.round(r.hr_bpm)}</span> : null}
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
      </div>
    </InputsCard>
  );
}