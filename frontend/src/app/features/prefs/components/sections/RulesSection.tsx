// src/features/coach/components/RulesSection.tsx
"use client";

import { useMemo, useState } from "react";
import Button from "@/app/shared/components/ui/Button";
import DisclosureToggle from "@/app/shared/components/ui/DisclosureToggle";
import { SECTION, SURFACE_INLINE } from "@/app/shared/ui/classes";
import { InfoPopover } from "@/app/features/coach/components/InfoPopover";

type Props = {
  /** pass local.preferences (or merged) sem */
  pref: any;
  prefDefaults: (p: any) => any;
  setLocal: (fn: (prev: any) => any) => void;
  markDirty: () => void;
};

type RuleKey = "avoid_back_to_back_hard" | "use_zones";

const RULES: Array<{
  key: RuleKey;
  label: string;
  short: string;
}> = [
  {
    key: "avoid_back_to_back_hard",
    label: "Avoid two hard days in a row",
    short: "No back-to-back hard",
  },
  { key: "use_zones", label: "Use zones", short: "Use zones" },
];

export function RulesSection({ pref, prefDefaults, setLocal, markDirty }: Props) {
  const [open, setOpen] = useState(false);

  const basePref = useMemo(() => {
    const p = prefDefaults(pref);
    const out = typeof p === "object" && p ? p : {};
    // normalize two_a_day
    const two = out.two_a_day;
    if (!two || typeof two !== "object") {
      out.two_a_day = { enabled: false, max_days_per_week: 0 };
    } else {
      out.two_a_day = {
        enabled: !!two.enabled,
        max_days_per_week:
          typeof two.max_days_per_week === "number"
            ? two.max_days_per_week
            : Number(two.max_days_per_week) || 0,
      };
    }
    return out;
  }, [pref, prefDefaults]);

  const toggleRule = (ruleKey: RuleKey) => {
    markDirty();
    setLocal((prev) => {
      const base = prefDefaults(prev?.preferences ?? prev) || {};
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

  const toggleTwoADay = () => {
    markDirty();
    setLocal((prev) => {
      const base = prefDefaults(prev?.preferences ?? prev) || {};
      const two = (base as any).two_a_day;
      const curEnabled = !!(two && typeof two === "object" ? two.enabled : false);
      const curMax =
        two && typeof two === "object"
          ? Number(two.max_days_per_week) || 0
          : 0;

      const nextEnabled = !curEnabled;
      const nextMax = nextEnabled ? Math.max(1, Math.min(2, curMax || 2)) : 0;

      return {
        ...prev,
        preferences: {
          ...base,
          two_a_day: {
            enabled: nextEnabled,
            max_days_per_week: nextMax,
          },
        },
      };
    });
  };

  const setTwoADayMax = (nextMax: number) => {
    markDirty();
    setLocal((prev) => {
      const base = prefDefaults(prev?.preferences ?? prev) || {};
      const two = (base as any).two_a_day;
      const curEnabled = !!(two && typeof two === "object" ? two.enabled : false);

      return {
        ...prev,
        preferences: {
          ...base,
          two_a_day: {
            enabled: curEnabled,
            max_days_per_week: Math.max(0, Math.min(2, nextMax)),
          },
        },
      };
    });
  };

  const enabledShort = RULES.filter((r) => !!basePref?.[r.key]).map((r) => r.short);
  const twoEnabled = !!basePref?.two_a_day?.enabled;
  const twoMax = Number(basePref?.two_a_day?.max_days_per_week) || 0;

  const previewParts = [
    enabledShort.length ? enabledShort.join(", ") : null,
    twoEnabled ? `2-a-day: up to ${twoMax} day(s)` : "2-a-day: off",
  ].filter(Boolean);

  const previewText = previewParts.length ? previewParts.join(" | ") : "none";

  return (
    <section className={SECTION}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium opacity-90">Rules</div>
        <div className="flex items-center gap-2">
          <InfoPopover text="Base composition rules. Two-a-day je objekt (enabled + max_days_per_week)." />
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
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {RULES.map(({ key, label, short }) => {
              const active = !!basePref?.[key];
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

          <div className={[SURFACE_INLINE, "px-3 py-3"].join(" ")}>
            <div className="flex items-center justify-between">
              <div className="text-xs opacity-80">Two-a-day</div>
              <Button
                type="button"
                size="sm"
                variant="prefs"
                active={twoEnabled}
                onClick={toggleTwoADay}
                title="Enable/disable two sessions in a day"
              >
                {twoEnabled ? "Enabled" : "Disabled"}
              </Button>
            </div>

            {twoEnabled && (
              <div className="mt-2 flex items-center gap-2">
                <div className="text-[11px] opacity-70">
                  Max days per week:
                </div>
                {[0, 1, 2].map((n) => (
                  <Button
                    key={n}
                    type="button"
                    size="xs"
                    variant="prefs"
                    active={twoMax === n}
                    onClick={() => setTwoADayMax(n)}
                    title={`${n}`}
                  >
                    {n}
                  </Button>
                ))}
                <div className="text-[11px] opacity-60 ml-2">
                  (0 = nikdy, 2 = max)
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}