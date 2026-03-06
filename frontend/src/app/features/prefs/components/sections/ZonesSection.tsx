// src/features/coach/components/prefs/ZonesSection.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

import InputsCard from "@/app/shared/ui/components/InputsCard";
import SelectField from "@/app/shared/ui/components/SelectField";
import TextField from "@/app/shared/ui/components/TextField";
import Button from "@/app/shared/ui/components/Button";
import { toast } from "@/app/shared/ui/components/Toast";
import { useT } from "@/app/shared/i18n/useT";
import { ZoneCalcMode } from "@/app/features/prefs/types/prefs";
import { TooltipIcon } from "@/app/shared/ui/components/Tooltip";

import {
  SECTION,
  SECTION_STYLE,
  INPUTS_CARD_BODY,
  INPUTS_CARD_LABEL_SM_1,
  PANEL_STACK,
  SURFACE_INLINE,
} from "@/app/shared/ui/tokens";

type Props = {
  zones: any | undefined;
  lthrBpm?: number | null;
  onZonesChange: (z: any) => void;
  onSaveZonesToDB?: (z: any) => Promise<void>;
  calcMode: ZoneCalcMode;
  onCalcModeChange: (mode: ZoneCalcMode) => void;
};

const SPORT_OPTIONS_KEYS = ["running", "ride", "swimming", "rowing", "strength", "other"] as const;
const ZONE_KEYS = ["z1_min", "z1_max", "z2_min", "z2_max", "z3_min", "z3_max", "z4_min", "z4_max", "z5_min", "z5_max"];

function validateZones(z: any, t: any): string[] {
  if (!z) return [t("prefs.sections.zonesSection.errors.empty")];
  const e: string[] = [];
  for (const k of ZONE_KEYS) {
    if (z[k] == null || Number.isNaN(Number(z[k])))
      e.push(`${String(k)}: ${t("prefs.sections.zonesSection.errors.mustBeNumber")}`);
  }

  const { z1_min, z1_max, z2_min, z2_max, z3_min, z3_max, z4_min, z4_max, z5_min, z5_max, hr_max } = z as Record<string, number>;

  if (z1_min >= z1_max || z2_min >= z2_max || z3_min >= z3_max || z4_min >= z4_max || z5_min >= z5_max) {
    e.push(t("prefs.sections.zonesSection.errors.minMax"));
  }

  if (!(z1_max < z2_min && z2_max <= z3_min && z3_max <= z4_min && z4_max <= z5_min)) {
    e.push(t("prefs.sections.zonesSection.errors.order"));
  }

  if (hr_max && z5_max > hr_max) e.push(t("prefs.sections.zonesSection.errors.maxHr").replace("{{hr}}", String(hr_max)));
  return e;
}

function recalc(mode: ZoneCalcMode, z: any, lthrBpm?: number | null) {
  if (!z || mode === "manual") return { ...z };
  const out = { ...z };
  const h = Number(z.hr_max) || 200;

  if (mode === "hrmax" || mode === "default") {
    out.z1_min = Math.round(h * 0.5); out.z1_max = Math.round(h * 0.6);
    out.z2_min = out.z1_max + 1; out.z2_max = Math.round(h * 0.7);
    out.z3_min = out.z2_max + 1; out.z3_max = Math.round(h * 0.8);
    out.z4_min = out.z3_max + 1; out.z4_max = Math.round(h * 0.9);
    out.z5_min = out.z4_max + 1; out.z5_max = h;
    return out;
  }

  if (mode === "percent_lthr" && Number.isFinite(Number(lthrBpm))) {
    const L = Number(lthrBpm);
    out.z1_min = Math.round(L * 0.65); out.z1_max = Math.round(L * 0.81);
    out.z2_min = out.z1_max + 1; out.z2_max = Math.round(L * 0.89);
    out.z3_min = out.z2_max + 1; out.z3_max = Math.round(L * 0.93);
    out.z4_min = out.z3_max + 1; out.z4_max = Math.round(L * 0.99);
    out.z5_min = out.z4_max + 1; out.z5_max = h;
    return out;
  }
  return out;
}

export default function ZonesSection({ 
  zones, 
  lthrBpm, 
  calcMode, 
  onCalcModeChange, 
  onZonesChange, 
  onSaveZonesToDB 
}: Props) {
  const t = useT();
  const [open, setOpen] = useState(false);

  const z = useMemo(() => ({
      sport: zones?.sport ?? "running",
      hr_max: zones?.hr_max ?? null,
      z1_min: zones?.z1_min ?? null, z1_max: zones?.z1_max ?? null,
      z2_min: zones?.z2_min ?? null, z2_max: zones?.z2_max ?? null,
      z3_min: zones?.z3_min ?? null, z3_max: zones?.z3_max ?? null,
      z4_min: zones?.z4_min ?? null, z4_max: zones?.z4_max ?? null,
      z5_min: zones?.z5_min ?? null, z5_max: zones?.z5_max ?? null,
  }), [zones]);

  const zonesLocked = calcMode !== "manual";
  const fmtRange = (a: any, b: any) => Number.isFinite(Number(a)) && Number.isFinite(Number(b)) ? `${Number(a)}–${Number(b)} bpm` : "—";
  const getSportLabel = (s: string) => (t as any)(`common.sports.${s === "running" ? "run" : s === "ride" ? "bike" : s}`);

  const previewNode = (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-3 text-xs">
      <div><span className="opacity-70 mr-1">{t("prefs.sections.zonesSection.previewAerobic")}:</span><span className="font-semibold">{fmtRange(z.z2_min, z.z2_max)}</span></div>
      <div><span className="opacity-70 mr-1">{t("prefs.sections.zonesSection.previewAnaerobic")}:</span><span className="font-semibold">{fmtRange(z.z4_min, z.z4_max)}</span></div>
      <div><span className="opacity-70 mr-1">HRmax:</span><span className="font-semibold">{z.hr_max ? `${z.hr_max} bpm` : "—"}</span></div>
    </div>
  );

  useEffect(() => {
    if (!zones) return;
    // Pri zmene módu alebo LTHR okamžite prepočítame náhľad zón
    onZonesChange(recalc(calcMode, { ...(zones ?? {}), sport: z.sport }, lthrBpm));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calcMode, zones?.hr_max, lthrBpm, z.sport]);

  return (
    <InputsCard
      title={<div className="flex items-center gap-2"><span>{t("prefs.sections.zonesSection.widget.title")}</span><TooltipIcon text={t("prefs.sections.zonesSection.widget.tooltip")} /></div>}
      subtitle={t("prefs.sections.zonesSection.subtitle")}
      preview={previewNode}
      open={open}
      onOpenChange={setOpen}
    >
      <div className={[INPUTS_CARD_BODY, PANEL_STACK].join(" ")}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <section className={SECTION} style={SECTION_STYLE}>
            <div className={INPUTS_CARD_LABEL_SM_1}>{t("prefs.sections.thresholdsSection.sportLabel")}</div>
            <SelectField value={z.sport} onChange={(e) => onZonesChange({ ...(zones ?? {}), sport: e.target.value })} options={SPORT_OPTIONS_KEYS.map(v => ({ value: v, label: getSportLabel(v) }))} />
          </section>

          <section className={SECTION} style={SECTION_STYLE}>
            <div className="flex items-center gap-2"><div className={INPUTS_CARD_LABEL_SM_1}>{t("prefs.sections.zonesSection.calcLabel")}</div><TooltipIcon text={t("prefs.sections.zonesSection.calcTooltip")} /></div>
            {/* ✅ Teraz voláme onCalcModeChange */}
            <SelectField 
              value={calcMode} 
              onChange={(e) => onCalcModeChange(e.target.value as ZoneCalcMode)} 
              options={[
                { value: "manual", label: t("prefs.sections.zonesSection.enums.mode.manual") },
                { value: "hrmax", label: t("prefs.sections.zonesSection.enums.mode.hrmax") },
                { value: "percent_lthr", label: t("prefs.sections.zonesSection.enums.mode.lthr") },
                { value: "default", label: t("prefs.sections.zonesSection.enums.mode.default") },
            ]} hint={calcMode === "percent_lthr" && !Number.isFinite(Number(lthrBpm)) ? t("prefs.sections.zonesSection.lthrMissingHint") : undefined} />
          </section>

          <section className={SECTION} style={SECTION_STYLE}>
            <div className={INPUTS_CARD_LABEL_SM_1}>HRmax (bpm)</div>
            <TextField label="" type="number" value={z.hr_max ?? ""} onChange={(e) => {
                const val = e.target.value ? Number(e.target.value) : null;
                const next = { ...(zones ?? {}), sport: z.sport, hr_max: val };
                onZonesChange(calcMode === "manual" ? next : recalc(calcMode, next, lthrBpm));
            }} />
          </section>

          <section className={SECTION} style={SECTION_STYLE}>
            <div className="flex items-center gap-2"><div className={INPUTS_CARD_LABEL_SM_1}>LTHR (bpm)</div><TooltipIcon text={t("prefs.sections.zonesSection.lthrTooltip")} /></div>
            <TextField label="" value={Number.isFinite(Number(lthrBpm)) ? String(lthrBpm) : ""} disabled hint={t("prefs.sections.zonesSection.lthrSourceHint")} />
          </section>
        </div>

        <div className="flex items-center gap-2"><div className={INPUTS_CARD_LABEL_SM_1}>{t("prefs.sections.zonesSection.zonesLabel")}</div><TooltipIcon text={zonesLocked ? t("prefs.sections.zonesSection.lockedTooltip") : t("prefs.sections.zonesSection.manualTooltip")} /></div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {(["z1", "z2", "z3", "z4", "z5"] as const).map((key) => (
            <div key={key} className={[SURFACE_INLINE, "px-3 py-2"].join(" ")}>
              <div className="text-[10px] opacity-70 uppercase mb-1">{key}</div>
              <div className="flex items-center gap-2">
                <TextField label="" type="number" disabled={zonesLocked} className="w-20 disabled:opacity-40" value={(z as any)[`${key}_min`] ?? ""} onChange={(e) => onZonesChange({ ...(zones ?? {}), sport: z.sport, [`${key}_min`]: e.target.value ? Number(e.target.value) : null })} />
                <span className="opacity-60">–</span>
                <TextField label="" type="number" disabled={zonesLocked} className="w-20 disabled:opacity-40" value={(z as any)[`${key}_max`] ?? ""} onChange={(e) => onZonesChange({ ...(zones ?? {}), sport: z.sport, [`${key}_max`]: e.target.value ? Number(e.target.value) : null })} />
              </div>
            </div>
          ))}
        </div>

        {onSaveZonesToDB && (
          <div className="pt-1">
            <Button type="button" size="sm" variant="success" onClick={async () => {
                const payload = { ...(zones ?? {}), ...z };
                const errs = validateZones(payload, t);
                if (errs.length) { toast.error(errs[0]); return; }
                await onSaveZonesToDB(payload);
            }}>{t("prefs.sections.zonesSection.saveBtn")}</Button>
          </div>
        )}
      </div>
    </InputsCard>
  );
}