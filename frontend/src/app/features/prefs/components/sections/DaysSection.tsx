// src/features/coach/components/DaysSection.tsx
"use client";

import { useMemo, useState } from "react";
import Button from "@/app/shared/ui/components/Button";
import type { DayAbbrev } from "@/app/shared/types/day";
import { InfoPopover } from "@/app/features/coach/components/InfoPopover";
import InputsCard from "@/app/shared/ui/components/InputsCard";

import { appColors } from "@/app/shared/ui/theme/app_colors";
import { INPUTS_CARD_BODY, PANEL_STACK } from "@/app/shared/ui/tokens";

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
  const [open, setOpen] = useState(false);

  const selectedOff = (daysOff ?? []) as DayAbbrev[];
  const selectedLong = (longRunDays ?? []) as DayAbbrev[];

  const previewText = useMemo(() => {
    const offTxt = selectedOff.length ? selectedOff.join(" · ") : "none";
    const longTxt = selectedLong.length ? selectedLong.join(" · ") : "none";
    return `Days off: ${offTxt} | Long run: ${longTxt}`;
  }, [selectedOff, selectedLong]);

  return (
    <InputsCard
      title="Days"
      subtitle={
        <span style={{ color: appColors.textMuted }}>
          Days off = dni bez tréningu. Long run = preferované dni pre dlhý beh.
        </span>
      }
      preview={previewText}
      open={open}
      onOpenChange={setOpen}
      always={
        <div className="flex items-start justify-end">
          <InfoPopover text="Days off = dni bez tréningu. Long run = preferované dni pre dlhý beh (coach sa snaží trafiť, ak nie je konflikt)." />
        </div>
      }
      backdropVariant="default"
    >
      <div className={[INPUTS_CARD_BODY, PANEL_STACK].join(" ")}>
        {/* Days off */}
        <div className="rounded-xl border border-white/10 bg-black/10 px-3 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-medium opacity-80">Days off</div>
            <div className="text-[11px] opacity-60">
              {selectedOff.length ? selectedOff.join(" · ") : "none"}
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
                  {d}
                </Button>
              );
            })}
          </div>

          <div className="text-[11px] opacity-60 mt-2">
            Môže byť aj prázdne (žiadne dni off).
          </div>
        </div>

        {/* Long run days */}
        <div className="rounded-xl border border-white/10 bg-black/10 px-3 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-medium opacity-80">Long-run days</div>
            <div className="text-[11px] opacity-60">
              {selectedLong.length ? selectedLong.join(" · ") : "none"}
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
                  {d}
                </Button>
              );
            })}
          </div>

          <div className="text-[11px] opacity-60 mt-2">
            Môže byť aj prázdne (coach si vyberie iný vhodný deň).
          </div>
        </div>
      </div>
    </InputsCard>
  );
}
