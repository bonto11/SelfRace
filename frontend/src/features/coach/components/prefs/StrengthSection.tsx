// src/features/coach/components/StrengthSection.tsx
"use client";

import { useState } from "react";
import Button from "@/shared/components/ui/Button";
import DisclosureToggle from "@/shared/components/ui/DisclosureToggle";
import { SECTION, PILL_BUTTON } from "@/shared/ui/classes";
import { InfoPopover } from "../InfoPopover";

const ACTIVE_PILL =
  "bg-emerald-600/90 border-emerald-500 text-white shadow-[inset_0_0_0_2px_rgba(16,185,129,.25)]";

type Props = {
  local: any;
  setLocal: (fn: (prev: any) => any) => void;
  markDirty: () => void;
};

export function StrengthSection({ local, setLocal, markDirty }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <section className={SECTION}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium opacity-90">Strength setup</div>
        <div className="flex items-center gap-2">
          <InfoPopover text="Vyber kde cvičíš a aké vybavenie máš. AI potom prispôsobí tréningy (bodyweight vs. činky, TRX, atď.)." />
          <DisclosureToggle
            open={open}
            onToggle={() => setOpen((o) => !o)}
            labelWhenOpen="Collapse Strength setup"
            labelWhenClosed="Expand Strength setup"
          />
        </div>
      </div>

      {/* Body (collapsible) */}
      {open && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Location */}
          <div>
            <div className="text-xs opacity-80 mb-1">Location</div>
            <div className="flex flex-wrap gap-2">
              {(["gym", "home", "outdoor"] as const).map((loc) => {
                const active =
                  (local.strength_settings?.location ?? null) === loc;
                return (
                  <Button
                    key={loc}
                    type="button"
                    size="sm"
                    variant="secondary"
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
                    className={[active ? ACTIVE_PILL : "border-white/15"].join(
                      " "
                    )}
                  >
                    {loc}
                  </Button>
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
                    <Button
                      key={mode}
                      type="button"
                      size="sm"
                      variant="secondary"
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
                        active ? ACTIVE_PILL : "border-white/15",
                      ].join(" ")}
                    >
                      {mode}
                    </Button>
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
                const next = active
                  ? cur.filter((k: string) => k !== key)
                  : [...cur, key];
                return (
                  <Button
                    key={key}
                    type="button"
                    size="xs"
                    variant="secondary"
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
                      "text-xs",
                      active ? ACTIVE_PILL : "border-white/15",
                    ].join(" ")}
                  >
                    {key}
                  </Button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
