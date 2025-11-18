// src/features/coach/components/RulesSection.tsx
"use client";

import { useState } from "react";
import DisclosureToggle from "@/shared/components/ui/DisclosureToggle";
import { SECTION, FORM_GRID_TWO, FORM_GRID_SPLIT } from "@/shared/ui/classes";
import { InfoPopover } from "../InfoPopover";
import type { DayAbbrev } from "@/shared/types/day";

type Props = {
  pref: any;
  prefDefaults: (p: any) => any;
  setLocal: (fn: (prev: any) => any) => void;
  markDirty: () => void;
};

export function RulesSection({
  pref,
  prefDefaults,
  setLocal,
  markDirty,
}: Props) {
  const [open, setOpen] = useState(false);

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
        <div className={FORM_GRID_TWO}>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!pref.avoid_back_to_back_hard}
              onChange={(e) => {
                markDirty();
                setLocal((prev) => ({
                  ...prev,
                  preferences: {
                    ...prefDefaults(prev),
                    avoid_back_to_back_hard: e.target.checked,
                  },
                }));
              }}
            />
            Avoid two hard days in a row
          </label>

          <div className={FORM_GRID_SPLIT}>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!pref.use_zones}
                onChange={(e) => {
                  markDirty();
                  setLocal((prev) => ({
                    ...prev,
                    preferences: {
                      ...prefDefaults(prev),
                      use_zones: e.target.checked,
                    },
                  }));
                }}
              />
              Use zones
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!pref.wu_cd_detail}
                onChange={(e) => {
                  markDirty();
                  setLocal((prev) => ({
                    ...prev,
                    preferences: {
                      ...prefDefaults(prev),
                      wu_cd_detail: e.target.checked,
                    },
                  }));
                }}
              />
              Include WU/CD details
            </label>
          </div>
        </div>
      )}
    </section>
  );
}
