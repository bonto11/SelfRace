"use client";

import { useMemo, useState } from "react";
import Button from "@/app/shared/ui/components/Button";
import type { DayAbbrev } from "@/app/shared/types/day";
import InputsCard from "@/app/shared/ui/components/InputsCard";
import { TooltipIcon } from "@/app/shared/ui/components/Tooltip";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { INPUTS_CARD_BODY, PANEL_STACK } from "@/app/shared/ui/tokens";
import { useT } from "@/app/shared/i18n/useT";

const ALL_DAYS: DayAbbrev[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type Props = {
  daysOff: DayAbbrev[] | undefined;
  longRunDays: DayAbbrev[] | undefined;
  toggleInArray: <T>(arr: T[] | undefined, v: T) => T[];
  setPrefNested: (
    path: "preferences.days_off" | "preferences.long_run_days",
    v: DayAbbrev[],
  ) => void;
};

export function DaysSection({
  daysOff,
  longRunDays,
  toggleInArray,
  setPrefNested,
}: Props) {
  const t = useT();
  const [open, setOpen] = useState(false);

  const selectedOff = (daysOff ?? []) as DayAbbrev[];
  const selectedLong = (longRunDays ?? []) as DayAbbrev[];

  // Pomocná funkcia na získanie skratky dňa z katalógu
  const getDayLabel = (d: DayAbbrev) => {
    const key = d.toLowerCase() as keyof typeof t; // mon, tue...
    return t(`common.weeksShort.${key}`);
  };

  const previewText = useMemo(() => {
    const noneTxt = t("common.none") || "žiadne";
    const offTxt = selectedOff.length 
      ? selectedOff.map(getDayLabel).join(" · ") 
      : noneTxt;
    const longTxt = selectedLong.length 
      ? selectedLong.map(getDayLabel).join(" · ") 
      : noneTxt;
      
    return `${t("prefs.sections.daysSection.previewDaysOff")}: ${offTxt} | ${t("prefs.sections.daysSection.previewLongRun")}: ${longTxt}`;
  }, [selectedOff, selectedLong, t]);

  return (
    <InputsCard
      title={
        <div className="flex items-center gap-2">
          <span>{t("prefs.sections.daysSection.widget.title")}</span>
          <TooltipIcon text={t("prefs.sections.daysSection.widget.tooltip")} />
        </div>
      }
      subtitle={
        <span style={{ color: appColors.textMuted }}>
          {t("prefs.sections.daysSection.subtitle")}
        </span>
      }
      preview={previewText}
      open={open}
      onOpenChange={setOpen}
      backdropVariant="default"
    >
      <div className={[INPUTS_CARD_BODY, PANEL_STACK].join(" ")}>
        {/* Days off */}
        <div className="rounded-xl border border-white/10 bg-black/10 px-3 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-medium opacity-80">
              {t("prefs.sections.daysSection.daysOffLabel")}
            </div>
            <div className="text-[11px] opacity-60">
              {selectedOff.length 
                ? selectedOff.map(getDayLabel).join(" · ") 
                : t("common.none")}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {ALL_DAYS.map((d) => {
              const active = selectedOff.includes(d);
              const next = toggleInArray(selectedOff, d) as DayAbbrev[];
              return (
                <Button
                  key={`off_${d}`}
                  type="button"
                  size="xs"
                  variant="prefs"
                  active={active}
                  onClick={() => setPrefNested("preferences.days_off", next)}
                >
                  {getDayLabel(d)}
                </Button>
              );
            })}
          </div>

          <div className="text-[11px] opacity-60 mt-2">
            {t("prefs.sections.daysSection.daysOffHint")}
          </div>
        </div>

        {/* Long run days */}
        <div className="rounded-xl border border-white/10 bg-black/10 px-3 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-medium opacity-80">
              {t("prefs.sections.daysSection.longRunLabel")}
            </div>
            <div className="text-[11px] opacity-60">
              {selectedLong.length 
                ? selectedLong.map(getDayLabel).join(" · ") 
                : t("common.none")}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {ALL_DAYS.map((d) => {
              const active = selectedLong.includes(d);
              const next = toggleInArray(selectedLong, d) as DayAbbrev[];
              return (
                <Button
                  key={`long_${d}`}
                  type="button"
                  size="xs"
                  variant="prefs"
                  active={active}
                  onClick={() =>
                    setPrefNested("preferences.long_run_days", next)
                  }
                >
                  {getDayLabel(d)}
                </Button>
              );
            })}
          </div>

          <div className="text-[11px] opacity-60 mt-2">
            {t("prefs.sections.daysSection.longRunHint")}
          </div>
        </div>
      </div>
    </InputsCard>
  );
}