"use client";

import { useMemo } from "react";
import Button from "@/app/shared/ui/components/Button";
import InputsCard from "@/app/shared/ui/components/InputsCard";
import { TooltipIcon } from "@/app/shared/ui/components/Tooltip";
import { useT } from "@/app/shared/i18n/useT";
import { INPUTS_CARD_BODY, PANEL_STACK } from "@/app/shared/ui/tokens";

type Props = {
  local: any;
  setLocal: (fn: (prev: any) => any) => void;
  markDirty: () => void;
};

const GEAR_OPTIONS = [
  "dumbbells", "barbell", "kettlebell", "trx", "pullup_bar",
  "resistance_bands", "bench", "medicine_ball", "sandbag", "box", "abwheel"
] as const;

export function StrengthSection({ local, setLocal, markDirty }: Props) {
  const t = useT();
  const settings = local.strength_settings ?? {};

  const location: string | null = settings.location ?? null;
  const mode: string | null = settings.equipment_mode ?? null;
  const available: string[] = Array.isArray(settings.available) ? settings.available : [];
  const sessionsPerWeek: number | null = settings.sessions_per_week != null ? Number(settings.sessions_per_week) : null;

  const previewText = useMemo(() => {
    // FIX: Pretypovanie t na any pri dynamických kľúčoch
    const locText = location ? (t as any)(`prefs.sections.strengthSection.locations.${location}`) : "—";
    const modeText = mode ? (t as any)(`prefs.sections.strengthSection.modes.${mode}`) : "—";
    const spw = sessionsPerWeek ?? "—";
    const gearCount = available.length;
    
    const listShort = gearCount === 0
      ? t("common.none")
      : gearCount <= 3
        ? available.map(k => (t as any)(`prefs.sections.strengthSection.gear.${k}`)).join(", ")
        : `${available.slice(0, 3).map(k => (t as any)(`prefs.sections.strengthSection.gear.${k}`)).join(", ")} +${gearCount - 3} ${t("common.more")}`;

    return `${t("prefs.sections.strengthSection.previewSessions")}: ${spw} • ${t("prefs.sections.strengthSection.previewLocation")}: ${locText} • ${t("prefs.sections.strengthSection.previewMode")}: ${modeText} | ${t("prefs.sections.strengthSection.previewGear")} (${gearCount}): ${listShort}`;
  }, [location, mode, available, sessionsPerWeek, t]);

  const setSessionsPerWeek = (next: number | null) => {
    markDirty();
    setLocal((p: any) => ({
      ...p,
      strength_settings: { ...(p.strength_settings ?? {}), sessions_per_week: next },
    }));
  };

  const setLocation = (next: string | null) => {
    markDirty();
    setLocal((p: any) => ({
      ...p,
      strength_settings: { ...(p.strength_settings ?? {}), location: next },
    }));
  };

  const setMode = (next: string | null) => {
    markDirty();
    setLocal((p: any) => ({
      ...p,
      strength_settings: { ...(p.strength_settings ?? {}), equipment_mode: next },
    }));
  };

  const toggleGear = (key: string) => {
    const active = available.includes(key);
    const next = active ? available.filter((k) => k !== key) : [...available, key];
    markDirty();
    setLocal((p: any) => ({
      ...p,
      strength_settings: { ...(p.strength_settings ?? {}), available: next },
    }));
  };

  return (
    <InputsCard
      title={
        <div className="flex items-center gap-2">
          <span>{t("prefs.sections.strengthSection.widget.title")}</span>
          <TooltipIcon text={t("prefs.sections.strengthSection.widget.tooltip")} />
        </div>
      }
      subtitle={t("prefs.sections.strengthSection.subtitle")}
      preview={previewText}
      defaultOpen={false}
      backdropVariant="default"
    >
      <div className={[INPUTS_CARD_BODY, PANEL_STACK].join(" ")}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs opacity-80 mb-1">
              <span>{t("prefs.sections.strengthSection.sessionsLabel")}</span>
              <TooltipIcon text={t("prefs.sections.strengthSection.sessionsTooltip")} />
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" variant="prefs" onClick={() => setSessionsPerWeek(Math.max(0, (sessionsPerWeek ?? 2) - 1))} title={t("prefs.sections.strengthSection.btnDecrease")}>−</Button>
              <div className="min-w-[42px] text-center text-sm font-semibold">{sessionsPerWeek ?? 2}</div>
              <Button type="button" size="sm" variant="prefs" onClick={() => setSessionsPerWeek(Math.min(7, (sessionsPerWeek ?? 2) + 1))} title={t("prefs.sections.strengthSection.btnIncrease")}>+</Button>
              <Button type="button" size="sm" variant="prefs" active={sessionsPerWeek == null} onClick={() => setSessionsPerWeek(null)} title={t("prefs.sections.strengthSection.btnUnset")}>—</Button>
            </div>
            <div className="text-[11px] opacity-60 mt-1">{t("prefs.sections.strengthSection.currentLabel")}: {sessionsPerWeek ?? 2}</div>
          </div>

          <div>
            <div className="text-xs opacity-80 mb-1">{t("prefs.sections.strengthSection.locationLabel")}</div>
            <div className="flex flex-wrap gap-2">
              {["gym", "home", "outdoor"].map((loc) => (
                <Button key={loc} type="button" size="sm" variant="prefs" active={location === loc} onClick={() => setLocation(location === loc ? null : loc)}>
                  {(t as any)(`prefs.sections.strengthSection.locations.${loc}`)}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs opacity-80 mb-1">{t("prefs.sections.strengthSection.modeLabel")}</div>
            <div className="flex flex-wrap gap-2">
              {["none", "bodyweight", "minimal", "full_gym"].map((m) => (
                <Button key={m} type="button" size="sm" variant="prefs" active={mode === m} onClick={() => setMode(mode === m ? null : m)}>
                  {(t as any)(`prefs.sections.strengthSection.modes.${m}`)}
                </Button>
              ))}
            </div>
          </div>

          <div className="md:col-span-3">
            <div className="flex items-center gap-2 text-xs opacity-80 mb-1">
              <span>{t("prefs.sections.strengthSection.gearLabel")}</span>
              <TooltipIcon text={t("prefs.sections.strengthSection.gearTooltip")} />
            </div>
            <div className="flex flex-wrap gap-2">
              {GEAR_OPTIONS.map((key) => (
                <Button key={key} type="button" size="xs" variant="prefs" active={available.includes(key)} onClick={() => toggleGear(key)} className="text-xs">
                  {(t as any)(`prefs.sections.strengthSection.gear.${key}`)}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </InputsCard>
  );
}