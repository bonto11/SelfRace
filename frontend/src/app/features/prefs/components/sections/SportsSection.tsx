// src/features/coach/components/prefs/SportsSection.tsx
"use client";

import { useState, useMemo } from "react";
import Button from "@/app/shared/components/ui/Button";
import SelectField from "@/app/shared/components/ui/SelectField";
import DisclosureToggle from "@/app/shared/components/ui/DisclosureToggle";
import { SURFACE_INLINE, SECTION } from "@/app/shared/ui/uiTokens";
import type { SportKind } from "@/app/features/prefs/types/prefs";
import { InfoPopover } from "@/app/features/coach/components/InfoPopover";

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
  const [open, setOpen] = useState(false);

  const preview = useMemo(() => {
    const main = mainSport || "— none —";
    const addons = Array.isArray(addOnSports) ? addOnSports : [];
    const addonsText = addons.length ? addons.join(", ") : "none";
    return {
      mainText: `Main: ${main}`,
      addonsText: `Add-ons: ${addonsText}`,
    };
  }, [mainSport, addOnSports]);

  const safeAddOns = Array.isArray(addOnSports) ? addOnSports : [];

  const toggleAddOn = (sport: SportKind) => {
    const main = (mainSport || null) as SportKind | null;
    if (main && sport === main) {
      // add-on nesmie byť rovnaký ako main
      return;
    }

    const cur = safeAddOns.filter((s) => s !== main); // safety
    const next = cur.includes(sport)
      ? cur.filter((s) => s !== sport)
      : [...cur, sport];

    setPref("add_on_sports", next);
  };

  return (
    <section className={SECTION}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium opacity-90">Sports</div>
        <div className="flex items-center gap-2">
          <InfoPopover text="Vyber hlavný šport pre plán. Doplnkové športy (add-ons) môže coach pridávať ako doplnok k hlavnému plánu. Silu rieš v sekcii Strength." />
          <DisclosureToggle
            open={open}
            onToggle={() => setOpen((o) => !o)}
            labelWhenOpen="Collapse sports"
            labelWhenClosed="Expand sports"
          />
        </div>
      </div>

      {/* Closed preview */}
      {!open && (
        <div
          className={[
            SURFACE_INLINE,
            "px-3 py-2 text-xs select-none opacity-80",
          ].join(" ")}
        >
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <span>{preview.mainText}</span>
            <span>{preview.addonsText}</span>
          </div>
        </div>
      )}

      {/* Body */}
      {open && (
        <div className="space-y-3">
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
              Ak riešiš hlavne beh, nastav <b>run</b>. Add-ons použiješ keď
              chceš, aby coach občas pridal ride/swim ako doplnok (regenerácia,
              objem).
            </div>
          </div>

          {/* Add-on sports */}
          <div className={[SURFACE_INLINE, "px-3 py-3"].join(" ")}>
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
      )}
    </section>
  );
}
