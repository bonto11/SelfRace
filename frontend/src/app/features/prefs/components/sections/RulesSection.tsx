// src/features/prefs/components/RulesSection.tsx
"use client";

import { useMemo, useState } from "react";
import Button from "@/app/shared/components/ui/Button";
import DisclosureToggle from "@/app/shared/components/ui/DisclosureToggle";
import { SECTION, SURFACE_INLINE } from "@/app/shared/ui/classes";
import { InfoPopover } from "@/app/features/coach/components/InfoPopover";
import type { Preferences } from "@/app/features/prefs/types/prefs";

type Props = {
  /** sem posielaj local.preferences (alebo už prefDefaults(local) – oboje ok) */
  pref: any;
  setLocal: (fn: (prev: any) => any) => void;
  markDirty: () => void;
};

type RuleKey = "avoid_back_to_back_hard" | "use_zones";

const RULES: Array<{ key: RuleKey; label: string; short: string }> = [
  {
    key: "avoid_back_to_back_hard",
    label: "Avoid two hard days in a row",
    short: "No back-to-back hard",
  },
  { key: "use_zones", label: "Use zones", short: "Use zones" },
];

function normalizePrefs(p: any): Preferences {
  const incoming = p && typeof p === "object" ? p : {};

  const two = incoming.two_a_day;
  const enabled = !!(two && typeof two === "object" ? two.enabled : false);
  const maxRaw =
    two && typeof two === "object" ? Number(two.max_days_per_week) : 0;
  const max = Number.isFinite(maxRaw) ? Math.max(0, Math.min(2, maxRaw)) : 0;

  return {
    days_off: Array.isArray(incoming.days_off) ? incoming.days_off : [],
    long_run_days: Array.isArray(incoming.long_run_days)
      ? incoming.long_run_days
      : [],
    avoid_back_to_back_hard:
      typeof incoming.avoid_back_to_back_hard === "boolean"
        ? incoming.avoid_back_to_back_hard
        : true,
    use_zones:
      typeof incoming.use_zones === "boolean" ? incoming.use_zones : true,
    include_strides:
      typeof incoming.include_strides === "boolean"
        ? incoming.include_strides
        : false,
    two_a_day: { enabled, max_days_per_week: max },
  };
}

export function RulesSection({ pref, setLocal, markDirty }: Props) {
  const [open, setOpen] = useState(false);

  const basePref = useMemo(() => normalizePrefs(pref), [pref]);

  const toggleRule = (key: RuleKey) => {
    markDirty();
    setLocal((prev) => {
      const cur = normalizePrefs(prev?.preferences);
      return {
        ...prev,
        preferences: {
          ...cur,
          [key]: !cur[key],
        },
      };
    });
  };

  const toggleTwoADay = () => {
    markDirty();
    setLocal((prev) => {
      const cur = normalizePrefs(prev?.preferences);
      const nextEnabled = !cur.two_a_day.enabled;
      return {
        ...prev,
        preferences: {
          ...cur,
          two_a_day: {
            enabled: nextEnabled,
            max_days_per_week: nextEnabled
              ? Math.max(1, Math.min(2, cur.two_a_day.max_days_per_week || 2))
              : 0,
          },
        },
      };
    });
  };

  const setTwoADayMax = (nextMax: number) => {
    markDirty();
    setLocal((prev) => {
      const cur = normalizePrefs(prev?.preferences);
      const clamped = Math.max(0, Math.min(2, nextMax));
      return {
        ...prev,
        preferences: {
          ...cur,
          two_a_day: {
            enabled: cur.two_a_day.enabled,
            max_days_per_week: clamped,
          },
        },
      };
    });
  };

  const enabledShort = RULES.filter((r) => !!basePref[r.key]).map(
    (r) => r.short
  );
  const twoEnabled = basePref.two_a_day.enabled;
  const twoMax = basePref.two_a_day.max_days_per_week;

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
          <InfoPopover text="Base composition rules. Two-a-day: enabled + max_days_per_week (0..2)." />
          <DisclosureToggle open={open} onToggle={() => setOpen((o) => !o)} />
        </div>
      </div>

      {!open && (
        <div className={[SURFACE_INLINE, "px-3 py-2 text-xs opacity-80 select-none"].join(" ")}>
          {previewText}
        </div>
      )}

      {open && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {RULES.map(({ key, label, short }) => (
              <Button
                key={key}
                type="button"
                size="sm"
                variant="prefs"
                active={!!basePref[key]}
                title={label}
                onClick={() => toggleRule(key)}
              >
                {short}
              </Button>
            ))}
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
                <div className="text-[11px] opacity-70">Max days/week:</div>
                {[1, 2].map((n) => (
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
                <Button
                  type="button"
                  size="xs"
                  variant="prefs"
                  active={twoMax === 0}
                  onClick={() => setTwoADayMax(0)}
                  title="0 = never"
                >
                  0
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}