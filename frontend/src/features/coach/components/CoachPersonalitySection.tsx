"use client";

import { SECTION, SURFACE_INSET, PILL_BUTTON } from "@/shared/ui/classes";
import { clamp01, PERSONA_TONES } from "@/features/coach/utils/persona";

const ACTIVE_PILL =
  "bg-emerald-600/90 border-emerald-500 text-white shadow-[inset_0_0_0_2px_rgba(16,185,129,.25)]";

type Props = {
  local: any;
  setPref: (key: any, value: any) => void;
  markDirty: () => void;
};

export function CoachPersonalitySection({
  local,
  setPref,
  markDirty,
}: Props) {
  const tone =
    local.coach_tone ?? ({
      directness: 50,
      praise: 50,
      challenge: 50,
      emoji: 20,
      explain: 60,
    } as any);

  const personaOptions: { key: any; label: string }[] = [
    { key: null, label: "None" },
    { key: "drill_sergeant", label: "Drill Sergeant" },
    { key: "motivator", label: "Motivator" },
    { key: "analyst", label: "Analyst" },
    { key: "realist", label: "Realist" },
    { key: "custom", label: "Custom" },
  ];

  return (
    <section className={SECTION}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium opacity-90">Coach personality</div>
        <div className="text-xs opacity-70">
          Presets lock sliders · Custom unlocks · None disables
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {personaOptions.map(({ key, label }) => {
          const active = (local.coach_voice ?? null) === key;
          return (
            <button
              key={label}
              type="button"
              onClick={() => {
                markDirty();
                if (key === null) {
                  setPref("coach_voice", null);
                } else if (key === "custom") {
                  setPref("coach_voice", "custom");
                  setPref(
                    "coach_tone",
                    local.coach_tone ?? {
                      directness: 50,
                      praise: 50,
                      challenge: 50,
                      emoji: 20,
                      explain: 60,
                    }
                  );
                } else {
                  setPref("coach_voice", key);
                  setPref("coach_tone", PERSONA_TONES[key]);
                }
              }}
              className={[
                PILL_BUTTON,
                active ? ACTIVE_PILL : "border-white/15",
              ].join(" ")}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* sliders */}
      <div className="mt-3 grid grid-cols-1 gap-2">
        {(
          ["directness", "praise", "challenge", "emoji", "explain"] as const
        ).map((key) => {
          const v = Number((tone as any)[key] ?? 50);
          const locked = local.coach_voice !== "custom";
          const disabled = local.coach_voice == null;
          return (
            <div
              key={key}
              className={[
                SURFACE_INSET,
                "px-3 py-2",
                disabled && "opacity-50",
              ].join(" ")}
            >
              <div className="flex items-center justify-between">
                <div className="text-sm capitalize">{key}</div>
                <div className="text-sm tabular-nums opacity-80">
                  {clamp01(v)}%
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={clamp01(v)}
                disabled={locked || disabled}
                onChange={(e) => {
                  const nv = clamp01(Number(e.target.value));
                  setPref("coach_tone", { ...tone, [key]: nv });
                }}
                className={[
                  "w-full mt-2",
                  locked || disabled
                    ? "opacity-50 cursor-not-allowed"
                    : "opacity-100",
                  "accent-emerald-500",
                ].join(" ")}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}