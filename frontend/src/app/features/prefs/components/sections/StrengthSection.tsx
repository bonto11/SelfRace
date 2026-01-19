// src/features/coach/components/StrengthSection.tsx
"use client";

import { useMemo, useState } from "react";
import Button from "@/app/shared/components/ui/Button";
import DisclosureToggle from "@/app/shared/components/ui/DisclosureToggle";
import { SECTION, SURFACE_INLINE } from "@/app/shared/ui/classes";
import { InfoPopover } from "@/app/features/coach/components/InfoPopover";

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
  const available: string[] = Array.isArray(settings.available)
    ? settings.available
    : [];
  const sessionsPerWeek: number | null =
    typeof settings.sessions_per_week === "number"
      ? settings.sessions_per_week
      : settings.sessions_per_week != null
      ? Number(settings.sessions_per_week) || null
      : null;

  const preview = useMemo(() => {
    const locText = location ?? "—";
    const modeText = mode ?? "—";
    const spw = sessionsPerWeek ?? "—";
    const gearCount = available.length;
    const listShort =
      gearCount === 0
        ? "none"
        : gearCount <= 3
        ? available.join(", ")
        : `${available.slice(0, 3).join(", ")} +${gearCount - 3} more`;

    return {
      line1: `Sessions/week: ${spw} • Location: ${locText} • Mode: ${modeText}`,
      line2: `Gear (${gearCount}): ${listShort}`,
    };
  }, [location, mode, available, sessionsPerWeek]);

  const setSessionsPerWeek = (next: number | null) => {
    markDirty();
    setLocal((p: any) => ({
      ...p,
      strength_settings: {
        ...(p.strength_settings ?? {}),
        sessions_per_week: next,
      },
    }));
  };

  return (
    <section className={SECTION}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium opacity-90">Strength setup</div>
        <div className="flex items-center gap-2">
          <InfoPopover text="Nastav koľko silových tréningov chceš týždenne a aké máš vybavenie. Detail cvikov doplní backend mapper." />
          <DisclosureToggle
            open={open}
            onToggle={() => setOpen((o) => !o)}
            labelWhenOpen="Collapse Strength setup"
            labelWhenClosed="Expand Strength setup"
          />
        </div>
      </div>

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

      {open && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Sessions per week */}
          <div>
            <div className="text-xs opacity-80 mb-1">Sessions per week</div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="prefs"
                onClick={() => {
                  const cur = sessionsPerWeek ?? 2;
                  setSessionsPerWeek(Math.max(0, cur - 1));
                }}
                title="Decrease"
              >
                −
              </Button>
              <div className="min-w-[42px] text-center text-sm">
                {sessionsPerWeek ?? 2}
              </div>
              <Button
                type="button"
                size="sm"
                variant="prefs"
                onClick={() => {
                  const cur = sessionsPerWeek ?? 2;
                  setSessionsPerWeek(Math.min(7, cur + 1));
                }}
                title="Increase"
              >
                +
              </Button>
              <Button
                type="button"
                size="sm"
                variant="prefs"
                active={sessionsPerWeek == null}
                onClick={() => setSessionsPerWeek(null)}
                title="Unset"
              >
                —
              </Button>
            </div>
            <div className="text-[11px] opacity-60 mt-1">
              Odporúčanie: 1–3. Nula = nechceš silu v pláne.
            </div>
          </div>

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
          <div className="md:col-span-3">
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