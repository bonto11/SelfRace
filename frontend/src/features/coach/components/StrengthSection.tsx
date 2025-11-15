"use client";

import Button from "@/shared/components/ui/Button";
import { SECTION, PILL_BUTTON } from "@/shared/ui/classes";

const ACTIVE_PILL =
  "bg-emerald-600/90 border-emerald-500 text-white shadow-[inset_0_0_0_2px_rgba(16,185,129,.25)]";

import { InfoPopover } from "./InfoPopover";

type Props = {
  local: any;
  setLocal: (fn: (prev: any) => any) => void;
  markDirty: () => void;
};

export function StrengthSection({ local, setLocal, markDirty }: Props) {
  return (
    <section className={SECTION}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium opacity-90">Strength setup</div>
        <InfoPopover text="Vyber kde cvičíš a aké vybavenie máš. AI potom prispôsobí tréningy (bodyweight vs. činky, TRX, atď.)." />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Location */}
        <div>
          <div className="text-xs opacity-80 mb-1">Location</div>
          <div className="flex flex-wrap gap-2">
            {(["gym", "home", "outdoor"] as const).map((loc) => {
              const active = (local.strength_settings?.location ?? null) === loc;
              return (
                <button
                  key={loc}
                  type="button"
                  onClick={() => {
                    markDirty();
                    setLocal((p) => ({
                      ...p,
                      strength_settings: {
                        ...(p.strength_settings ?? {}),
                        location: active ? null : loc,
                      },
                    }));
                  }}
                  className={[
                    PILL_BUTTON,
                    active ? ACTIVE_PILL : "border-white/15",
                  ].join(" ")}
                >
                  {loc}
                </button>
              );
            })}
          </div>
        </div>

        {/* Equipment mode */}
        <div>
          <div className="text-xs opacity-80 mb-1">Equipment mode</div>
          <div className="flex flex-wrap gap-2">
            {(["none", "bodyweight", "minimal", "full_gym"] as const).map(
              (mode) => {
                const active =
                  (local.strength_settings?.equipment_mode ?? null) === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      markDirty();
                      setLocal((p) => ({
                        ...p,
                        strength_settings: {
                          ...(p.strength_settings ?? {}),
                          equipment_mode: active ? null : mode,
                        },
                      }));
                    }}
                    className={[
                      PILL_BUTTON,
                      active ? ACTIVE_PILL : "border-white/15",
                    ].join(" ")}
                  >
                    {mode}
                  </button>
                );
              }
            )}
          </div>
        </div>

        {/* Available gear */}
        <div>
          <div className="text-xs opacity-80 mb-1">Available gear</div>
          <div className="flex flex-wrap gap-2">
            {(
              [
                "dumbbells",
                "barbell",
                "kettlebell",
                "trx",
                "pullup_bar",
                "resistance_bands",
                "bench",
                "medicine_ball",
                "sandbag",
                "box",
                "abwheel",
              ] as const
            ).map((key) => {
              const cur = local.strength_settings?.available ?? [];
              const active = cur.includes(key);
              const next = active ? cur.filter((k: string) => k !== key) : [...cur, key];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    markDirty();
                    setLocal((p) => ({
                      ...p,
                      strength_settings: {
                        ...(p.strength_settings ?? {}),
                        available: next,
                      },
                    }));
                  }}
                  className={[
                    PILL_BUTTON,
                    "text-xs",
                    active ? ACTIVE_PILL : "border-white/15",
                  ].join(" ")}
                >
                  {key}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}