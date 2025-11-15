"use client";

import { SECTION, FORM_GRID_TWO, FORM_GRID_SPLIT } from "@/shared/ui/classes";
import type { DayAbbrev } from "@/shared/types/day";

type Props = {
  pref: any;
  prefDefaults: (p: any) => any;
  setLocal: (fn: (prev: any) => any) => void;
  markDirty: () => void;
};

export function RulesSection({ pref, prefDefaults, setLocal, markDirty }: Props) {
  return (
    <section className={SECTION}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium opacity-90">Rules</div>
        <div className="text-xs opacity-70">Base composition rules.</div>
      </div>
      <div className={FORM_GRID_TWO}>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={!!pref.avoid_back_to_back_hard}
            onChange={(e) =>
              setLocal((prev) => ({
                ...prev,
                preferences: {
                  ...prefDefaults(prev),
                  avoid_back_to_back_hard: e.target.checked,
                },
              }))
            }
            onInput={markDirty}
          />
          Avoid two hard days in a row
        </label>

        <div className={FORM_GRID_SPLIT}>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!pref.use_zones}
              onChange={(e) =>
                setLocal((prev) => ({
                  ...prev,
                  preferences: {
                    ...prefDefaults(prev),
                    use_zones: e.target.checked,
                  },
                }))
              }
              onInput={markDirty}
            />
            Use zones
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!pref.wu_cd_detail}
              onChange={(e) =>
                setLocal((prev) => ({
                  ...prev,
                  preferences: {
                    ...prefDefaults(prev),
                    wu_cd_detail: e.target.checked,
                  },
                }))
              }
              onInput={markDirty}
            />
            Include WU/CD details
          </label>
        </div>
      </div>
    </section>
  );
}