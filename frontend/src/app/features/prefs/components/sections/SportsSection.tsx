// src/features/coach/components/prefs/SportsSection.tsx
"use client";

import { useMemo } from "react";

import Button from "@/app/shared/ui/components/Button";
import SelectField from "@/app/shared/ui/components/SelectField";
import InputsCard from "@/app/shared/ui/components/InputsCard";
import type { SportKind } from "@/app/features/prefs/types/prefs";
import { InfoPopover } from "@/app/features/coach/components/InfoPopover";

import { INPUTS_CARD_BODY, PANEL_STACK } from "@/app/shared/ui/tokens";

// DB-aligned: strength rieši StrengthSection, nie coach prefs sports mix
const MAIN_SPORTS: SportKind[] = ["run", "ride", "swim"];
const ADD_ON_SPORTS: SportKind[] = ["run", "ride", "swim"];

type Props = {
  local: any;
  mainSport: SportKind | "";
  /** DB: add_on_sports: SportKind[] */
  addOnSports: SportKind[];
  setPref: (key: any, value: any) => void;
};

export function SportsSection({
  local,
  mainSport,
  addOnSports,
  setPref,
}: Props) {
  const preview = useMemo(() => {
    const main = mainSport || "— none —";
    const addons = Array.isArray(addOnSports) ? addOnSports : [];
    const addonsText = addons.length ? addons.join(", ") : "none";
    return `Main: ${main} | Add-ons: ${addonsText}`;
  }, [mainSport, addOnSports]);

  const safeAddOns = Array.isArray(addOnSports) ? addOnSports : [];

  const toggleAddOn = (sport: SportKind) => {
    const main = (mainSport || null) as SportKind | null;
    if (main && sport === main) return; // add-on nesmie byť rovnaký ako main

    const cur = safeAddOns.filter((s) => s !== main); // safety
    const next = cur.includes(sport)
      ? cur.filter((s) => s !== sport)
      : [...cur, sport];
    setPref("add_on_sports", next);
  };

  return (
    <InputsCard
      title={
        <div className="flex items-center gap-2">
          <span>Sports</span>
          <InfoPopover text="Vyber hlavný šport pre plán. Doplnkové športy (add-ons) môže coach pridávať ako doplnok k hlavnému plánu. Silu rieš v sekcii Strength." />
        </div>
      }
      subtitle="Hlavný šport + doplnkové športy (bez strength)."
      preview={preview}
      defaultOpen={false}
      backdropVariant="default"
    >
      <div className={[INPUTS_CARD_BODY, PANEL_STACK].join(" ")}>
        {/* Main sport */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div>
            <div className="text-xs opacity-80 mb-1">Main sport</div>
            <SelectField
              value={mainSport}
              onChange={(e) => {
                const v = (e.target.value as SportKind | "") || "";
                const nextMain = v === "" ? null : (v as SportKind);

                setPref("main_sport", nextMain);

                // ensure add_on_sports neobsahuje main_sport
                const curAddOns = Array.isArray(local.add_on_sports)
                  ? (local.add_on_sports as SportKind[])
                  : [];
                const cleaned = nextMain
                  ? curAddOns.filter((s) => s !== nextMain)
                  : curAddOns;
                setPref("add_on_sports", cleaned);
              }}
              options={[
                { value: "", label: "— none —" },
                ...MAIN_SPORTS.map((s) => ({ value: s, label: s })),
              ]}
            />
          </div>

          <div className="sm:col-span-2 text-xs opacity-70 flex items-end">
            Ak riešiš hlavne beh, nastav <b>run</b>. Add-ons použiješ keď chceš,
            aby coach občas pridal ride/swim ako doplnok (regenerácia, objem).
          </div>
        </div>

        {/* Add-on sports */}
        <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs opacity-80">Add-on sports</div>
            <div className="text-[11px] opacity-60">
              (bez strength; to je samostatne)
            </div>
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
                  title={disabled ? "Toto je main sport" : "Toggle add-on"}
                  disabled={disabled}
                >
                  {s}
                </Button>
              );
            })}
          </div>

          {safeAddOns.length === 0 && (
            <div className="text-[11px] opacity-60 mt-2">
              Žiadne add-ons. Plán bude čisto podľa main sport.
            </div>
          )}
        </div>
      </div>
    </InputsCard>
  );
}
