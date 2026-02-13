"use client";

import { useMemo } from "react";
import Button from "@/app/shared/ui/components/Button";
import SelectField from "@/app/shared/ui/components/SelectField";
import InputsCard from "@/app/shared/ui/components/InputsCard";
import type { SportKind } from "@/app/features/prefs/types/prefs";
import { TooltipIcon } from "@/app/shared/ui/components/Tooltip";
import { useT } from "@/app/shared/i18n/useT";
import { INPUTS_CARD_BODY, PANEL_STACK } from "@/app/shared/ui/tokens";

const MAIN_SPORTS: SportKind[] = ["run", "ride", "swim"];
const ADD_ON_SPORTS: SportKind[] = ["run", "ride", "swim"];

type Props = {
  local: any;
  mainSport: SportKind | "";
  addOnSports: SportKind[];
  setPref: (key: any, value: any) => void;
};

export function SportsSection({
  local,
  mainSport,
  addOnSports,
  setPref,
}: Props) {
  const t = useT();

  // FIX: Pretypovanie na any kvôli dynamickému kľúču
  const getSportLabel = (s: string) => {
    if (!s) return t("common.none");
    const key = s === "ride" ? "bike" : s;
    return (t as any)(`common.sports.${key}`);
  };

  const preview = useMemo(() => {
    const main = getSportLabel(mainSport);
    const addons = Array.isArray(addOnSports) ? addOnSports : [];
    const addonsText = addons.length 
      ? addons.map(s => getSportLabel(s)).join(", ") 
      : t("common.none");
    return `${t("prefs.sections.sportsSection.previewMain")}: ${main} | ${t("prefs.sections.sportsSection.previewAddons")}: ${addonsText}`;
  }, [mainSport, addOnSports, t]);

  const safeAddOns = Array.isArray(addOnSports) ? addOnSports : [];

  const toggleAddOn = (sport: SportKind) => {
    const main = (mainSport || null) as SportKind | null;
    if (main && sport === main) return; 

    const cur = safeAddOns.filter((s) => s !== main); 
    const next = cur.includes(sport)
      ? cur.filter((s) => s !== sport)
      : [...cur, sport];
    setPref("add_on_sports", next);
  };

  return (
    <InputsCard
      title={
        <div className="flex items-center gap-2">
          <span>{t("prefs.sections.sportsSection.widget.title")}</span>
          <TooltipIcon text={t("prefs.sections.sportsSection.widget.tooltip")} />
        </div>
      }
      subtitle={t("prefs.sections.sportsSection.subtitle")}
      preview={preview}
      defaultOpen={false}
      backdropVariant="default"
    >
      <div className={[INPUTS_CARD_BODY, PANEL_STACK].join(" ")}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div>
            <div className="text-xs opacity-80 mb-1">{t("prefs.sections.sportsSection.mainSportLabel")}</div>
            <SelectField
              value={mainSport}
              onChange={(e) => {
                const v = (e.target.value as SportKind | "") || "";
                const nextMain = v === "" ? null : (v as SportKind);
                setPref("main_sport", nextMain);
                const curAddOns = Array.isArray(local.add_on_sports) ? local.add_on_sports : [];
                const cleaned = nextMain ? curAddOns.filter((s: string) => s !== nextMain) : curAddOns;
                setPref("add_on_sports", cleaned);
              }}
              options={[
                { value: "", label: `— ${t("common.none")} —` },
                ...MAIN_SPORTS.map((s) => ({ value: s, label: getSportLabel(s) })),
              ]}
            />
          </div>
          <div className="sm:col-span-2 text-xs opacity-70 flex items-end">
            {t("prefs.sections.sportsSection.mainSportHint")}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs opacity-80">{t("prefs.sections.sportsSection.addonsLabel")}</div>
            <div className="text-[11px] opacity-60">{t("prefs.sections.sportsSection.addonsNote")}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {ADD_ON_SPORTS.map((s) => {
              const disabled = !!mainSport && s === mainSport;
              const active = safeAddOns.includes(s) && !disabled;
              return (
                <Button
                  key={s}
                  type="button"
                  size="sm"
                  variant="prefs"
                  active={active}
                  onClick={() => toggleAddOn(s)}
                  title={disabled ? t("prefs.sections.sportsSection.disabledTitle") : t("prefs.sections.sportsSection.toggleTitle")}
                  disabled={disabled}
                >
                  {getSportLabel(s)}
                </Button>
              );
            })}
          </div>
          {safeAddOns.length === 0 && (
            <div className="text-[11px] opacity-60 mt-2">{t("prefs.sections.sportsSection.noAddons")}</div>
          )}
        </div>
      </div>
    </InputsCard>
  );
}