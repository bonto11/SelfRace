// src/features/prefs/components/RulesSection.tsx
"use client";

import { useMemo, useState } from "react";
import Button from "@/app/shared/components/ui/Button";
import DisclosureToggle from "@/app/shared/components/ui/DisclosureToggle";
import { SECTION, SURFACE_INLINE } from "@/app/shared/ui/classes";
import { InfoPopover } from "@/app/features/coach/components/InfoPopover";
import type { Preferences } from "@/app/features/prefs/types/prefs";

type Props = {
  pref: any; // local.preferences (alebo prefDefaults(local))
  setLocal: (fn: (prev: any) => any) => void;
  markDirty: () => void;
};

type RuleKey = "avoid_back_to_back_hard" | "use_zones";

const BASE_RULES: Array<{ key: RuleKey; label: string; short: string }> = [
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
    // include_strides ignorujeme úplne (nepoužívame)
    two_a_day: { enabled, max_days_per_week: max },
  } as Preferences;
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

  // --- Intensity model (top-level: polarized_model / pyramidal_model) ---
  const setIntensityModel = (model: "polarized" | "pyramidal") => {
    markDirty();
    setLocal((prev) => ({
      ...prev,
      polarized_model: model === "polarized",
      pyramidal_model: model === "pyramidal",
    }));
  };

  // --- Training blocks (top-level toggles) ---
  const toggleBlock = (key: "vo2max_training" | "ftp_training" | "threshold_focus") => {
    markDirty();
    setLocal((prev) => ({ ...prev, [key]: !prev?.[key] }));
  };

  const pol = false; // computed in render below (avoid stale)
  const enabledShort = BASE_RULES.filter((r) => !!basePref[r.key]).map(
    (r) => r.short
  );

  return (
    <section className={SECTION}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium opacity-90">Rules</div>
        <div className="flex items-center gap-2">
          <InfoPopover text="Rules + intensity model + optional blocks. Ukladá sa do coach.prefs (user_prefs)." />
          <DisclosureToggle open={open} onToggle={() => setOpen((o) => !o)} />
        </div>
      </div>

      {!open && (
        <div className={[SURFACE_INLINE, "px-3 py-2 text-xs opacity-80 select-none"].join(" ")}>
          <span className="opacity-80">
            {enabledShort.length ? enabledShort.join(", ") : "none"}
          </span>
        </div>
      )}

      {open && (
        <div className="space-y-3">
          {/* Base rules */}
          <div className="flex flex-wrap gap-2">
            {BASE_RULES.map(({ key, label, short }) => (
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

          {/* Two-a-day */}
          <div className={[SURFACE_INLINE, "px-3 py-3"].join(" ")}>
            <div className="flex items-center justify-between">
              <div className="text-xs opacity-80">Two-a-day</div>
              <Button
                type="button"
                size="sm"
                variant="prefs"
                active={!!basePref.two_a_day?.enabled}
                onClick={toggleTwoADay}
              >
                {basePref.two_a_day?.enabled ? "Enabled" : "Disabled"}
              </Button>
            </div>

            {!!basePref.two_a_day?.enabled && (
              <div className="mt-2 flex items-center gap-2">
                <div className="text-[11px] opacity-70">Max days/week:</div>
                {[1, 2].map((n) => (
                  <Button
                    key={n}
                    type="button"
                    size="xs"
                    variant="prefs"
                    active={Number(basePref.two_a_day?.max_days_per_week) === n}
                    onClick={() => setTwoADayMax(n)}
                  >
                    {n}
                  </Button>
                ))}
                <Button
                  type="button"
                  size="xs"
                  variant="prefs"
                  active={Number(basePref.two_a_day?.max_days_per_week) === 0}
                  onClick={() => setTwoADayMax(0)}
                  title="0 = never"
                >
                  0
                </Button>
              </div>
            )}
          </div>

          {/* Intensity model */}
          <div className={[SURFACE_INLINE, "px-3 py-3"].join(" ")}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs opacity-80">Intensity model</div>
              <InfoPopover text="Vyber len 1. Polarized (80/20) je default pre väčšinu. Pyramidal je viac Z2–Z3." />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="xs"
                variant="prefs"
                active={!!(pref && (pref as any).polarized_model)}
                onClick={() => setIntensityModel("polarized")}
              >
                Polarized (80/20)
              </Button>
              <Button
                type="button"
                size="xs"
                variant="prefs"
                active={!!(pref && (pref as any).pyramidal_model)}
                onClick={() => setIntensityModel("pyramidal")}
              >
                Pyramidal
              </Button>
            </div>
          </div>

          {/* Training blocks */}
          <div className={[SURFACE_INLINE, "px-3 py-3"].join(" ")}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs opacity-80">Training blocks</div>
              <InfoPopover text="Optional emphasis blocks (len flagy). Planner si ich môže zapnúť ako krátke fázy." />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="xs"
                variant="prefs"
                active={!!(pref && (pref as any).vo2max_training)}
                onClick={() => toggleBlock("vo2max_training")}
              >
                VO₂max (run)
              </Button>

              <Button
                type="button"
                size="xs"
                variant="prefs"
                active={!!(pref && (pref as any).ftp_training)}
                onClick={() => toggleBlock("ftp_training")}
              >
                FTP (ride)
              </Button>

              <Button
                type="button"
                size="xs"
                variant="prefs"
                active={!!(pref && (pref as any).threshold_focus)}
                onClick={() => toggleBlock("threshold_focus")}
              >
                Threshold focus
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}