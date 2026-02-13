// src/features/coach/components/FocusAvoidSection.tsx
"use client";

import { useState } from "react";
import Button from "@/app/shared/ui/components/Button";
import InputsCard from "@/app/shared/ui/components/InputsCard";
import { TooltipIcon } from "@/app/shared/ui/components/Tooltip";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { INPUTS_CARD_BODY, PANEL_STACK } from "@/app/shared/ui/tokens";
import { useT } from "@/app/shared/i18n/useT";

const FOCUS_CHOICES = [
  "ankle_strength",
  "foot_intrinsics",
  "calf_strength",
  "hamstrings",
  "glutes",
  "core_stability",
  "thoracic_mobility",
  "shoulder_stability",
] as const;

const AVOID_CHOICES = [
  "impact_high",
  "downhill_runs",
  "hard_surfaces",
  "back_to_back_speed",
] as const;

type Props = {
  local: any;
  setPref: (key: any, value: any) => void;
  toggleInArray: <T>(arr: T[] | undefined, v: T) => T[];
};

export function FocusAvoidSection({ local, setPref, toggleInArray }: Props) {
  const t = useT();
  const [open, setOpen] = useState(false);

  const focusArr = (local.focus_areas as string[] | undefined) ?? [];
  const avoidArr = (local.avoid_zones as string[] | undefined) ?? [];

  const preview = `${t("prefs.sections.focusAvoidSection.previewFocus")}: ${focusArr.length || 0} · ${t("prefs.sections.focusAvoidSection.previewAvoid")}: ${avoidArr.length || 0}`;

  return (
    <InputsCard
      title={
        <div className="flex items-center gap-2">
          <span>{t("prefs.sections.focusAvoidSection.widget.title")}</span>
          <TooltipIcon text={t("prefs.sections.focusAvoidSection.widget.tooltip")} />
        </div>
      }
      subtitle={
        <span style={{ color: appColors.textMuted }}>
          {t("prefs.sections.focusAvoidSection.subtitle")}
        </span>
      }
      preview={preview}
      open={open}
      onOpenChange={setOpen}
      backdropVariant="default"
    >
      <div className={[INPUTS_CARD_BODY, PANEL_STACK].join(" ")}>
        {/* Focus */}
        <div className="rounded-xl border border-white/10 bg-black/10 px-3 py-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs font-medium opacity-80">{t("prefs.sections.focusAvoidSection.areasLabel")}</div>
            <TooltipIcon text={t("prefs.sections.focusAvoidSection.areasTooltip")} />
          </div>

          <div className="flex flex-wrap gap-2">
            {FOCUS_CHOICES.map((k) => {
              const active = focusArr.includes(k);
              const next = toggleInArray(focusArr, k);
              return (
                <Button
                  key={k}
                  type="button"
                  size="xs"
                  variant="prefs"
                  active={active}
                  onClick={() => setPref("focus_areas", next)}
                >
                  {t(`prefs.sections.focusAvoidSection.areas.${k}`)}
                </Button>
              );
            })}
          </div>
        </div>

        {/* Avoid */}
        <div className="rounded-xl border border-white/10 bg-black/10 px-3 py-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs font-medium opacity-80">{t("prefs.sections.focusAvoidSection.avoidLabel")}</div>
            <TooltipIcon text={t("prefs.sections.focusAvoidSection.avoidTooltip")} />
          </div>

          <div className="flex flex-wrap gap-2">
            {AVOID_CHOICES.map((k) => {
              const active = avoidArr.includes(k);
              const next = toggleInArray(avoidArr, k);
              return (
                <Button
                  key={k}
                  type="button"
                  size="xs"
                  variant="prefs"
                  active={active}
                  onClick={() => setPref("avoid_zones", next)}
                >
                  {t(`prefs.sections.focusAvoidSection.avoids.${k}`)}
                </Button>
              );
            })}
          </div>
        </div>
      </div>
    </InputsCard>
  );
}