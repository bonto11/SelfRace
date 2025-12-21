// src/features/coach/components/StrengthSection.tsx
"use client";

import { useMemo, useState } from "react";
import Button from "@/app/shared/components/ui/Button";
import DisclosureToggle from "@/app/shared/components/ui/DisclosureToggle";
import { SECTION, SURFACE_INLINE } from "@/app/shared/ui/classes";
import { InfoPopover } from "@/features/coach/components/InfoPopover";

type Props = {
  local: any;
  setLocal: (fn: (prev: any) => any) => void;
  markDirty: () => void;
};

export function StrengthSection({ local, setLocal, markDirty }: Props) {
  const [open, setOpen] = useState(false);

  const settings = local.strength_settings ?? {};
  const location: "gym" | "home" | "outdoor" | null = settings.location ?? null;
  const mode: "none" | "bodyweight" | "minimal" | "full_gym" | null =
    settings.equipment_mode ?? null;
  const available: string[] = settings.available ?? [];

  // ------- closed preview -------
  const preview = useMemo(() => {
    const locText = location ?? "—";
    const modeText = mode ?? "—";
    const gearCount = available.length;
    const listShort =
      gearCount === 0
        ? "none"
        : gearCount <= 3
        ? available.join(", ")
        : `${available.slice(0, 3).join(", ")} +${gearCount - 3} more`;

    return {
      line1: `Location: ${locText} • Mode: ${modeText}`,
      line2: `Gear (${gearCount}): ${listShort}`,
    };
  }, [location, mode, available]);

  return (
    <section className={SECTION}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium opacity-90">Strength setup</div>
        <div className="flex items-center gap-2">
          <InfoPopover text="Choose where you train and what gear you have. Workouts adapt (bodyweight vs. weights, TRX, etc.)." />
          <DisclosureToggle
            open={open}
            onToggle={() => setOpen((o) => !o)}
            labelWhenOpen="Collapse Strength setup"
            labelWhenClosed="Expand Strength setup"
          />
        </div>
      </div>

      {/* Closed preview */}
      {!open && (
        <div
          className={[
            SURFACE_INLINE,
            "px-3 py-2 text-xs opacity-80 select-none",
          ].join(" ")}
        >
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <span>{preview.line1}</span>
            <span>{preview.line2}</span>
          </div>
        </div>
      )}

      {/* Body (collapsible) */}
      {open && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Location */}
          <div>
            <div className="text-xs opacity-80 mb-1">Location</div>
            <div className="flex flex-wrap gap-2">
              {(["gym", "home", "outdoor"] as const).map((loc) => {
                const active = location === loc;
                return (
                  <Button
                    key={loc}
                    type="button"
                    size="sm"
                    variant="prefs"
                    active={active}
                    onClick={() => {
                      markDirty();
                      setLocal((p: any) => ({
                        ...p,
                        strength_settings: {
                          ...(p.strength_settings ?? {}),
                          location: active ? null : loc,
                        },
                      }));
                    }}
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
                (m) => {
                  const active = mode === m;
                  return (
                    <Button
                      key={m}
                      type="button"
                      size="sm"
                      variant="prefs"
                      active={active}
                      onClick={() => {
                        markDirty();
                        setLocal((p: any) => ({
                          ...p,
                          strength_settings: {
                            ...(p.strength_settings ?? {}),
                            equipment_mode: active ? null : m,
                          },
                        }));
                      }}
                    >
                      {m}
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
                const active = available.includes(key);
                const next = active
                  ? available.filter((k: string) => k !== key)
                  : [...available, key];
                return (
                  <Button
                    key={key}
                    type="button"
                    size="xs"
                    variant="prefs"
                    active={active}
                    onClick={() => {
                      markDirty();
                      setLocal((p: any) => ({
                        ...p,
                        strength_settings: {
                          ...(p.strength_settings ?? {}),
                          available: next,
                        },
                      }));
                    }}
                    className="text-xs"
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
