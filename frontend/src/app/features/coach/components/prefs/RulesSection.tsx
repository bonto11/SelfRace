// src/features/coach/components/RulesSection.tsx
"use client";

import { useState } from "react";
import Button from "@/app/shared/components/ui/Button";
import DisclosureToggle from "@/app/shared/components/ui/DisclosureToggle";
import { SECTION, SURFACE_INLINE } from "@/app/shared/ui/classes";
import { InfoPopover } from "@/app/features/coach/components/InfoPopover";

type Props = {
  pref: any;
  prefDefaults: (p: any) => any;
  setLocal: (fn: (prev: any) => any) => void;
  markDirty: () => void;
};

const RULES: Array<{
  key: "avoid_back_to_back_hard" | "use_zones" | "avoid_two_a_day";
  label: string; // tooltip
  short: string; // pill text
}> = [
  {
    key: "avoid_back_to_back_hard",
    label: "Avoid two hard days in a row",
    short: "No back-to-back hard",
  },
  { key: "use_zones", label: "Use zones", short: "Use zones" },
  {
    key: "avoid_two_a_day",
    label: "Avoid two sessions in one day",
    short: "No 2phase sessions",
  },
];

export function RulesSection({
  pref,
  prefDefaults,
  setLocal,
  markDirty,
}: Props) {
  const [open, setOpen] = useState(false);

  const toggleRule = (ruleKey: (typeof RULES)[number]["key"]) => {
    markDirty();
    setLocal((prev) => {
      const base = prefDefaults(prev);
      const current = !!(base as any)[ruleKey];
      return {
        ...prev,
        preferences: {
          ...base,
          [ruleKey]: !current,
        },
      };
    });
  };

  const enabled = RULES.filter((r) => !!pref?.[r.key]).map((r) => r.short);
  const previewText = enabled.length > 0 ? `${enabled.join(", ")}` : "none";

  return (
    <section className={SECTION}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium opacity-90">Rules</div>
        <div className="flex items-center gap-2">
          <InfoPopover text="Base composition rules." />
          <DisclosureToggle open={open} onToggle={() => setOpen(!open)} />
        </div>
      </div>

      {!open && (
        <div
          className={[
            SURFACE_INLINE,
            "px-3 py-2 text-xs opacity-80 select-none",
          ].join(" ")}
        >
          {previewText}
        </div>
      )}

      {open && (
        <div className="flex flex-wrap gap-2">
          {RULES.map(({ key, label, short }) => {
            const active = !!pref?.[key];
            return (
              <Button
                key={key}
                type="button"
                size="sm"
                variant="prefs"
                active={active}
                title={label}
                onClick={() => toggleRule(key)}
              >
                {short}
              </Button>
            );
          })}
        </div>
      )}
    </section>
  );
}
