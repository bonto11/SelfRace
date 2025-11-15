"use client";

import { SECTION, SURFACE_INLINE, PILL_BUTTON } from "@/shared/ui/classes";
import { inputClass } from "@/shared/ui";
import type { SportKind } from "@/features/coach/types/prefsTypes";
import { InfoPopover } from "./InfoPopover";

const ACTIVE_PILL =
  "bg-emerald-600/90 border-emerald-500 text-white shadow-[inset_0_0_0_2px_rgba(16,185,129,.25)]";

const ALL_SPORTS: SportKind[] = ["run", "ride", "strength"];

type SecondaryRole = "none" | "supplement" | "improve";
type SecondaryMix = {
  sport: SportKind;
  role: SecondaryRole;
  share_pct: number;
};

type Props = {
  local: any;
  mainSport: SportKind | "";
  secondary: SecondaryMix[];
  shareWarn: boolean;
  setPref: (key: any, value: any) => void;
  updateSecondary: (sport: SportKind, patch: Partial<SecondaryMix>) => void;
};

export function SportsSection({
  local,
  mainSport,
  secondary,
  shareWarn,
  setPref,
  updateSecondary,
}: Props) {
  const sumShare = secondary.reduce(
    (a, b) => a + (Number.isFinite(b.share_pct) ? b.share_pct : 0),
    0
  );

  return (
    <section className={SECTION}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium opacity-90">Sports</div>
        <InfoPopover text="Choose main sport (or None). For others pick role and share %. Role 'None' hides it from planning." />
      </div>

      {/* Main sport */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div>
          <div className="text-xs opacity-80 mb-1">Main sport</div>
          <select
            className={inputClass}
            value={mainSport}
            onChange={(e) => {
              const v = e.target.value as SportKind | "";
              setPref("main_sport", v === "" ? null : (v as SportKind));
              const filtered = (local.secondary_mix ?? []).filter(
                (s: any) => s.sport !== v
              );
              setPref("secondary_mix", filtered as any);
            }}
          >
            <option value="">— none —</option>
            {ALL_SPORTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <div className="text-xs opacity-80 mb-1">Secondary share (sum)</div>
          <div
            className={[
              SURFACE_INLINE,
              "px-3 py-2 text-sm font-semibold tabular-nums",
              shareWarn ? "text-rose-300" : "opacity-90",
            ].join(" ")}
          >
            {sumShare}% {shareWarn ? "— reduce below 100%" : ""}
          </div>
        </div>
      </div>

      {/* Secondary rows */}
      <div className="mt-3 grid grid-cols-1 gap-2">
        {secondary.map((sec) => {
          const disableSlider = sec.role === "none";

          return (
            <div
              key={sec.sport}
              className={[SURFACE_INLINE, "px-3 py-2"].join(" ")}
            >
              <div className="flex items-center gap-3 flex-wrap">
                <div className="min-w-[80px] text-sm font-medium">
                  {sec.sport}
                </div>

                {/* role toggles */}
                <div className="inline-flex items-center gap-1">
                  {(["none", "supplement", "improve"] as const).map((r) => {
                    const active = sec.role === r;
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => {
                          const nextShare =
                            r === "none"
                              ? 0
                              : sec.share_pct && sec.share_pct > 0
                              ? sec.share_pct
                              : 25;
                          updateSecondary(sec.sport, {
                            role: r,
                            share_pct: nextShare,
                          });
                        }}
                        className={[
                          PILL_BUTTON,
                          "text-xs px-2 py-1",
                          active ? ACTIVE_PILL : "border-white/15",
                        ].join(" ")}
                        title={r}
                      >
                        {r}
                      </button>
                    );
                  })}
                </div>

                {/* slider + numeric */}
                <div className="flex items-center gap-2 flex-1 min-w-[220px]">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={sec.share_pct}
                    disabled={disableSlider}
                    onChange={(e) =>
                      updateSecondary(sec.sport, {
                        share_pct: Number(e.target.value),
                      })
                    }
                    className={[
                      "flex-1",
                      "accent-emerald-500",
                      disableSlider ? "opacity-50 cursor-not-allowed" : "",
                    ].join(" ")}
                  />
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={5}
                    value={sec.share_pct}
                    disabled={disableSlider}
                    onChange={(e) => {
                      const v = Math.max(
                        0,
                        Math.min(100, Number(e.target.value || 0))
                      );
                      updateSecondary(sec.sport, { share_pct: v });
                    }}
                    className="w-16 text-right text-sm tabular-nums bg-transparent border border-white/15 rounded px-2 py-1"
                  />
                </div>

                <div className="ml-auto flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      updateSecondary(sec.sport, {
                        role: "none",
                        share_pct: 0,
                      })
                    }
                    className={[PILL_BUTTON, "text-xs px-2 py-1"].join(" ")}
                  >
                    clear
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateSecondary(sec.sport, {
                        role: "supplement",
                        share_pct: 25,
                      })
                    }
                    className={[PILL_BUTTON, "text-xs px-2 py-1"].join(" ")}
                  >
                    reset
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}