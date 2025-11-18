"use client";

import { useState } from "react";
import Button from "@/shared/components/ui/Button";
import DisclosureToggle from "@/shared/components/ui/DisclosureToggle";
import {
  SECTION,
  PILL_BUTTON,
  COLOR_PREFS_ACTIVE,
  COLOR_PREFS_INACTIVE,
} from "@/shared/ui/classes";
import { InfoPopover } from "@/features/coach/components/InfoPopover";

type Props = {
  pref: any;
  prefDefaults: (p: any) => any;
  setLocal: (fn: (prev: any) => any) => void;
  markDirty: () => void;
};

const RULES: Array<{
  key: "avoid_back_to_back_hard" | "use_zones" | "wu_cd_detail";
  label: string;      // full text (tooltip)
  short: string;      // pill text
}> = [
  {
    key: "avoid_back_to_back_hard",
    label: "Avoid two hard days in a row",
    short: "No back-to-back hard",
  },
  {
    key: "use_zones",
    label: "Use zones",
    short: "Use zones",
  },
  {
    key: "wu_cd_detail",
    label: "Include warm-up / cool-down details",
    short: "WU/CD details",
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

  return (
    <section className={SECTION}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium opacity-90">Rules</div>
        <div className="flex items-center gap-2">
          <InfoPopover text="Base composition rules." />
          <DisclosureToggle open={open} onToggle={() => setOpen(!open)} />
        </div>
      </div>

      {open && (
        <div className="flex flex-wrap gap-2">
          {RULES.map(({ key, label, short }) => {
            const active = !!pref?.[key];
            return (
              <Button
                key={key}
                type="button"
                size="sm"
                variant="secondary"
                title={label} // tooltip s plným textom
                onClick={() => toggleRule(key)}
                className={[
                  PILL_BUTTON,
                  active ? COLOR_PREFS_ACTIVE : COLOR_PREFS_INACTIVE,
                ].join(" ")}
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