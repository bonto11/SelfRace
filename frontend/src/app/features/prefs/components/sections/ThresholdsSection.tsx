// src/features/coach/components/prefs/ThresholdsSection.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

import InputsCard from "@/app/shared/ui/components/InputsCard";
import SelectField from "@/app/shared/ui/components/SelectField";
import TextField from "@/app/shared/ui/components/TextField";
import NumberWheelField from "@/app/shared/ui/components/NumberWheelField";
import Button from "@/app/shared/ui/components/Button";
import { toast } from "@/app/shared/ui/components/Toast";
import { useT } from "@/app/shared/i18n/useT";

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
  thresholds: any | undefined;
  latestList?: any[];
  onChange: (t: any) => void;
  onSaveToDB?: (t: any) => Promise<void>;
};

const normalizeSportKey = (s: any): string => {
  const v = String(s || "").toLowerCase();
  if (v === "run") return "running";
  return v;
};

const makeComboKey = (sport: any, thrType: any): string =>
  `${normalizeSportKey(sport)}|${String(thrType || "").toLowerCase()}`;

const THR_SPORTS_VALUES = [
  "running",
  "ride",
  "swimming",
  "rowing",
  "strength",
  "other",
] as const;

export default function ThresholdsSection({
  thresholds,
  latestList = [],
  onChange,
  onSaveToDB,
}: Props) {
  const t = useT();
  const thr = thresholds ?? {};
  const [open, setOpen] = useState(false);

  const [paceStr, setPaceStr] = useState<string>(secToPace(thr.pace_sec_km));
  useEffect(() => {
    setPaceStr(secToPace(thr.pace_sec_km));
  }, [thr.pace_sec_km]);

  const latestByCombo = useMemo(() => {
    const map = new Map<string, any>();
    for (const r of Array.isArray(latestList) ? latestList : []) {
      const key = makeComboKey(r.sport, r.threshold_type);
      if (!map.has(key)) map.set(key, r);
    }
    return Array.from(map.values());
  }, [latestList]);

  const preview = useMemo(() => {
    const key = makeComboKey(
      thr.sport ?? "running",
      thr.threshold_type ?? "LT2",
    );
    const fromLatest = latestByCombo.find(
      (r) => makeComboKey(r.sport, r.threshold_type) === key,
    );
    const src = { ...(fromLatest ?? {}), ...thr };
    return {
      sport: src.sport ?? "running",
      type: src.threshold_type ?? "LT2",
      hr: src.hr_bpm,
      pace: secToPace(src.pace_sec_km),
      pow: src.power_watt,
    };
  }, [thr, latestByCombo]);

  const getSportLabel = (s: string) =>
    (t as any)(
      `common.sports.${s === "running" ? "run" : s === "ride" ? "bike" : s}`,
    );

  const previewNode = (
    <div className="flex flex-wrap gap-4 text-xs">
      <div>
        <span className="opacity-70 mr-1">
          {t("prefs.sections.thresholdsSection.sportLabel")}:
        </span>
        <span className="font-semibold">{getSportLabel(preview.sport)}</span>
      </div>
      <div>
        <span className="opacity-70 mr-1">
          {t("prefs.sections.thresholdsSection.typeLabel")}:
        </span>
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
          <span className="opacity-70 mr-1">{t("common.metrics.pace")}:</span>
          <span className="font-semibold">{preview.pace} /km</span>
        </div>
      )}
      {preview.pow != null && (
        <div>
          <span className="opacity-70 mr-1">{t("common.metrics.power")}:</span>
          <span className="font-semibold">{Math.round(preview.pow)} W</span>
        </div>
      )}
    </div>
  );

  const handleSaveToDB = async () => {
    if (!onSaveToDB) return;

    const hrOk = thr.hr_bpm == null || Number.isFinite(Number(thr.hr_bpm));
    const paceOk =
      thr.pace_sec_km == null ||
      (Number.isFinite(Number(thr.pace_sec_km)) && Number(thr.pace_sec_km) > 0);
    const powOk =
      thr.power_watt == null ||
      (Number.isFinite(Number(thr.power_watt)) && Number(thr.power_watt) > 0);

    if (!hrOk || !paceOk || !powOk) {
      toast.error(t("prefs.sections.thresholdsSection.errors.invalidValues"));
      return;
    }

    await onSaveToDB(thr);
  };

  return (
    <InputsCard
      title={
        <div className="flex items-center gap-2">
          <span>{t("prefs.sections.thresholdsSection.widget.title")}</span>
          <TooltipIcon
            text={t("prefs.sections.thresholdsSection.widget.tooltip")}
          />
        </div>
      }
      subtitle={t("prefs.sections.thresholdsSection.subtitle")}
      preview={previewNode}
      open={open}
      onOpenChange={setOpen}
      actions={
        onSaveToDB ? (
          <Button
            type="button"
            size="sm"
            variant="primary"
            onClick={handleSaveToDB}
          >
            {t("prefs.sections.thresholdsSection.saveBtn")}
          </Button>
        ) : null
      }
    >
      <div className={[INPUTS_CARD_BODY, PANEL_STACK].join(" ")}>
        <div className={FORM_GRID_TWO}>
          <section className={SECTION} style={SECTION_STYLE}>
            <div className={INPUTS_CARD_LABEL_SM_1}>
              {t("prefs.sections.thresholdsSection.sportLabel")}
            </div>
            <SelectField
              value={thr.sport ?? "running"}
              onChange={(e) => onChange({ ...thr, sport: e.target.value })}
              options={THR_SPORTS_VALUES.map((v) => ({
                value: v,
                label: getSportLabel(v),
              }))}
            />
          </section>

          <section className={SECTION} style={SECTION_STYLE}>
            <div className={INPUTS_CARD_LABEL_SM_1}>
              {t("prefs.sections.thresholdsSection.typeLabel")}
            </div>
            <SelectField
              value={thr.threshold_type ?? "LT2"}
              onChange={(e) =>
                onChange({ ...thr, threshold_type: e.target.value })
              }
              options={[
                { value: "LT1", label: "LT1 (aerobic)" },
                { value: "LT2", label: "LT2 (anaerobic / LTHR)" },
                { value: "FTP", label: "FTP (cycling)" },
              ]}
            />
          </section>
        </div>

        <div className={FORM_GRID_TWO}>
          <section className={SECTION} style={SECTION_STYLE}>
            <div className={INPUTS_CARD_LABEL_SM_1}>
              {t("prefs.sections.thresholdsSection.hrLabel")}
            </div>
            <NumberWheelField
              min={40}
              max={220}
              step={1}
              suffix="bpm"
              value={thr.hr_bpm ?? ""}
              onChange={(e) =>
                onChange({
                  ...thr,
                  hr_bpm: e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
          </section>

          <section className={SECTION} style={SECTION_STYLE}>
            <div className={INPUTS_CARD_LABEL_SM_1}>
              {t("prefs.sections.thresholdsSection.paceLabel")}
            </div>
            <TextField
              value={paceStr}
              placeholder="04:55"
              hint="mm:ss /km"
              onChange={(e) => {
                const v = normalizePaceInput(e.target.value);
                setPaceStr(v);
                onChange({ ...thr, pace_sec_km: paceToSec(v) });
              }}
            />
          </section>

          <section className={SECTION} style={SECTION_STYLE}>
            <div className={INPUTS_CARD_LABEL_SM_1}>
              {t("prefs.sections.thresholdsSection.powerLabel")}
            </div>
            <TextField
              type="number"
              inputMode="numeric"
              value={thr.power_watt ?? ""}
              onChange={(e) =>
                onChange({
                  ...thr,
                  power_watt:
                    e.target.value === "" ? null : Number(e.target.value),
                })
              }
              placeholder="W"
            />
          </section>

          <section className={SECTION} style={SECTION_STYLE}>
            <div className={INPUTS_CARD_LABEL_SM_1}>
              {t("prefs.sections.thresholdsSection.measurementLabel")}
            </div>
            <SelectField
              value={thr.measurement_type ?? "estimate garmin"}
              onChange={(e) =>
                onChange({ ...thr, measurement_type: e.target.value })
              }
              options={[
                {
                  value: "lab test",
                  label: t(
                    "prefs.sections.thresholdsSection.enums.measure.lab",
                  ),
                },
                {
                  value: "field test",
                  label: t(
                    "prefs.sections.thresholdsSection.enums.measure.field",
                  ),
                },
                { value: "estimate garmin", label: "Estimate – Garmin" },
                { value: "estimate strava", label: "Estimate – Strava" },
                {
                  value: "coach estimate",
                  label: t(
                    "prefs.sections.thresholdsSection.enums.measure.coach",
                  ),
                },
                { value: "other", label: t("common.sports.other") },
              ]}
            />
          </section>
        </div>

        {latestByCombo.length > 0 && (
          <div className="mt-1">
            <div className="flex items-center gap-2">
              <div className={INPUTS_CARD_LABEL_SM_1}>
                {t("prefs.sections.thresholdsSection.dbTitle")}
              </div>
              <TooltipIcon
                text={t("prefs.sections.thresholdsSection.dbTooltip")}
              />
            </div>

            <ul className="mt-2 flex flex-wrap gap-2">
              {latestByCombo.map((r, i) => (
                <li
                  key={`${r.sport}-${r.threshold_type}-${i}`}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-[11px]"
                >
                  <span className="font-medium">{getSportLabel(r.sport)}</span>
                  <span className="opacity-80"> · {r.threshold_type}</span>
                  {r.hr_bpm ? <span> · {Math.round(r.hr_bpm)} bpm</span> : null}
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
