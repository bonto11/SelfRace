// src/features/coach/components/CoachPreferencies/index.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  CoachPrefs,
  GoalKind,
  SportKind,
  CoachPersona,
  ExternalActivity,
  ExternalIntensity,
  ExternalSport,
  Injury,
  InjuryArea,
  InjuryType,
  RehabFocus,
} from "@/features/coach/types/prefsTypes";
import type { DayAbbrev } from "@/shared/types/day";
import { useUserId } from "@/shared/hooks/useUserId";
import { toast } from "@/shared/components/ui/Toast";
import {
  readCoachPrefsFromStorage,
  refreshCoachPrefsFromDB,
  saveCoachPrefs,
} from "@/features/coach/utils/prefs";

import Button from "@/shared/components/ui/Button";
import TextField from "@/shared/components/ui/TextField";
import {
  NO_X,
  SURFACE_INSET,
  SURFACE_INLINE,
  SECTION,
  FORM_GRID_TWO,
  FORM_GRID_SPLIT,
  PILL_BUTTON,
} from "@/shared/ui/classes";
import { inputClass } from "@/shared/ui";
import { PERSONA_TONES, clamp01 } from "@/features/coach/utils/persona";

/* ---- local DTOs ---- */
type SecondaryRole = "none" | "supplement" | "improve";
type SecondaryMix = {
  sport: SportKind;
  role: SecondaryRole;
  share_pct: number;
};

type CoachPrefsExtended = CoachPrefs & {
  main_sport?: SportKind | null;
  secondary_mix?: SecondaryMix[];
  coach_voice?: CoachPersona | null;
};

const ALL_DAYS: DayAbbrev[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const ALL_SPORTS: SportKind[] = ["run", "ride", "strength"];
const ALL_GOALS: GoalKind[] = [
  "race_time",
  "improve_speed",
  "improve_endurance",
  "improve_overall",
  "maintain",
];

const EXT_SPORTS: ExternalSport[] = [
  "football",
  "run",
  "ride",
  "strength",
  "other",
];
const EXT_INTENS: ExternalIntensity[] = ["low", "moderate", "high"];
const INJ_AREAS: InjuryArea[] = [
  "foot",
  "ankle",
  "shin",
  "knee",
  "hip",
  "hamstring",
  "calf",
  "back",
  "shoulder",
  "other",
];
const INJ_TYPES: InjuryType[] = [
  "overuse",
  "acute",
  "tendon",
  "stress",
  "shin_splints",
  "plantar",
  "itb",
  "other",
];

const FOCUS_CHOICES = [
  "ankle_strength",
  "foot_intrinsics",
  "calf_strength",
  "hamstrings",
  "glutes",
  "core_stability",
  "thoracic_mobility",
  "shoulder_stability",
];
const AVOID_CHOICES = [
  "impact_high",
  "downhill_runs",
  "hard_surfaces",
  "back_to_back_speed",
];

const ACTIVE_PILL =
  "bg-emerald-600/90 border-emerald-500 text-white shadow-[inset_0_0_0_2px_rgba(16,185,129,.25)]";

function isoTodayPlus(days: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
const DEFAULT_PLAN_START = () => isoTodayPlus(2); // predvyplň = D+2
const MIN_PLAN_START = () => isoTodayPlus(1); // min = zajtra

/* --- tiny popover --- */
function InfoPopover({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="px-2 py-1 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-xs"
      >
        i
      </button>
      {open && (
        <div
          className={[
            SURFACE_INSET,
            "absolute right-0 mt-2 w-[min(74vw,360px)] p-3 text-xs leading-snug z-30",
          ].join(" ")}
        >
          {text}
        </div>
      )}
    </div>
  );
}

export default function PrefsForm() {
  const { userId } = useUserId();

  const dirtyRef = useRef(false);
  const markDirty = () => {
    dirtyRef.current = true;
  };

  const [local, setLocal] = useState<CoachPrefsExtended>(
    () => readCoachPrefsFromStorage() as CoachPrefsExtended
  );

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      try {
        const p = await refreshCoachPrefsFromDB(userId);
        if (!alive) return;
        if (!dirtyRef.current) setLocal(p as CoachPrefsExtended);
      } catch {}
    })();
    return () => {
      alive = false;
    };
  }, [userId]);

  useEffect(() => {
    // ak chýba start_date → doplň default (D+2)
    if (!local?.start_date) {
      setLocal((p) => ({ ...p, start_date: DEFAULT_PLAN_START() }));
    }
    // ak je staršie ako zajtra → posuň na zajtra (UI guard)
    else {
      const min = MIN_PLAN_START();
      if (local.start_date < min) {
        setLocal((p) => ({ ...p, start_date: min }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const prefDefaults = (p: CoachPrefsExtended) =>
    p.preferences ?? {
      days_off: [],
      long_run_days: [],
      avoid_back_to_back_hard: true,
      use_zones: true,
      wu_cd_detail: true,
    };

  const toggleInArray = <T,>(arr: T[] | undefined, v: T): T[] =>
    (arr ?? []).includes(v)
      ? (arr ?? []).filter((x) => x !== v)
      : [...(arr ?? []), v];

  const setPref = <K extends keyof CoachPrefsExtended>(
    key: K,
    val: CoachPrefsExtended[K]
  ) => {
    markDirty();
    setLocal((prev) => ({ ...prev, [key]: val }));
  };

  const setPrefNested = (
    path: "preferences.days_off" | "preferences.long_run_days",
    v: any
  ) => {
    markDirty();
    const p = prefDefaults(local);
    const next = { ...local, preferences: p };
    if (path.endsWith("days_off"))
      next.preferences!.days_off = v as DayAbbrev[];
    if (path.endsWith("long_run_days"))
      next.preferences!.long_run_days = v as DayAbbrev[];
    setLocal(next);
  };

  const upsertRunTargets = (
    patch: Partial<NonNullable<CoachPrefsExtended["targets"]>["run"]>
  ) => {
    markDirty();
    setLocal((prev) => ({
      ...prev,
      targets: {
        run: {
          race_goal: prev.targets?.run?.race_goal ?? null,
          current_best_time: prev.targets?.run?.current_best_time ?? null,
          target_time: prev.targets?.run?.target_time ?? null,
          longest_recent_distance_km:
            prev.targets?.run?.longest_recent_distance_km ?? null,
          ...patch,
        },
        ride: prev.targets?.ride ?? {
          focus: "endurance",
          weekly_time_target_min: null,
        },
        strength: prev.targets?.strength ?? {
          focus: "general",
          sessions_per_week: 2,
        },
      },
    }));
  };

  const onSave = async () => {
    if (!userId) return;
    try {
      const activeSecondaries = (local.secondary_mix ?? [])
        .filter((x) => x.role !== "none" && Number(x.share_pct) > 0)
        .map((x) => x.sport);
      const primaries = [
        ...(local.main_sport ? [local.main_sport] : []),
        ...activeSecondaries,
      ];

       // guard: start_date min = zajtra
      const minIso = MIN_PLAN_START();
      const startIso = (local.start_date ?? "").trim();
      const safeStart = !startIso || startIso < minIso ? minIso : startIso;
      const normalized: CoachPrefsExtended = {
        ...local,
        start_date: safeStart,
        primary_sports: primaries.length ? primaries : undefined,
        secondary_mix: (local.secondary_mix ?? []).map((x) =>
          x.role === "none" ? { ...x, share_pct: 0 } : x
        ),
      };

      await saveCoachPrefs(userId, normalized);
      toast.success("Preferences saved");
      dirtyRef.current = false;
    } catch (e: any) {
      toast.error(String(e?.message ?? e));
    }
  };

  const onRefresh = async () => {
    if (!userId) return;
    try {
      const fresh = await refreshCoachPrefsFromDB(userId);
      if (!dirtyRef.current) setLocal(fresh as CoachPrefsExtended);
      toast.success("Refreshed");
    } catch (e: any) {
      toast.error(String(e?.message ?? e));
    }
  };

  const pref = prefDefaults(local);
  const [showAdv, setShowAdv] = useState(false);

  /* -------- Sports (main + secondary) -------- */
  const mainSport: SportKind | "" = (local.main_sport ?? "") as any;

  const secondary: SecondaryMix[] = useMemo(() => {
    const cur = (local.secondary_mix ?? []).filter(
      (s) => s.sport !== local.main_sport
    );
    const missing = ALL_SPORTS.filter((s) => s !== local.main_sport)
      .filter((s) => !cur.some((x) => x.sport === s))
      .map<SecondaryMix>((s) => ({ sport: s, role: "none", share_pct: 0 }));
    return [...cur, ...missing];
  }, [local.secondary_mix, local.main_sport]);

  const setSecondary = (mix: SecondaryMix[]) => {
    markDirty();
    setLocal((p) => ({ ...p, secondary_mix: mix }));
  };
  const updateSecondary = (sport: SportKind, patch: Partial<SecondaryMix>) => {
    const next = secondary.map((x) =>
      x.sport === sport ? { ...x, ...patch } : x
    );
    setSecondary(next);
  };

  const sumShare = secondary.reduce(
    (a, b) => a + (Number.isFinite(b.share_pct) ? b.share_pct : 0),
    0
  );
  const shareWarn = sumShare > 100;

  /* -------- Drafts (advanced) -------- */
  const [extDraft, setExtDraft] = useState<ExternalActivity>({
    day: "Tue",
    sport: "football",
    intensity: "high",
    note: "",
  });
  const [injDraft, setInjDraft] = useState<Injury>({
    area: "foot",
    type: "overuse",
    note: "bolesť nártov po dlhých behoch",
  });

  /* -------- Tone / persona -------- */
  const tone = local.coach_tone ?? {
    directness: 50,
    praise: 50,
    challenge: 50,
    emoji: 20,
    explain: 60,
  };
  const personaOptions: { key: CoachPersona | null; label: string }[] = [
    { key: null, label: "None" },
    { key: "drill_sergeant", label: "Drill Sergeant" },
    { key: "motivator", label: "Motivator" },
    { key: "analyst", label: "Analyst" },
    { key: "realist", label: "Realist" },
    { key: "custom", label: "Custom" },
  ];

  return (
    <div className={["space-y-4", NO_X].join(" ")}>
      {/* GOAL */}
      <section className={SECTION}>
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium opacity-90">Goal</div>
          <InfoPopover text="Pick the overall goal. Click again to clear." />
        </div>

        <div className="flex flex-wrap gap-2">
          {ALL_GOALS.map((g) => {
            const active = local.goal_kind === g;
            return (
              <button
                key={g}
                onClick={() => setPref("goal_kind", active ? undefined : g)}
                className={[
                  PILL_BUTTON,
                  active ? ACTIVE_PILL : "border-white/15",
                ].join(" ")}
              >
                {g}
              </button>
            );
          })}
          {/* explicit None */}
          <button
            onClick={() => setPref("goal_kind", undefined)}
            className={[
              PILL_BUTTON,
              !local.goal_kind ? ACTIVE_PILL : "border-white/15",
            ].join(" ")}
          >
            None
          </button>
        </div>

        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
          <TextField
            placeholder="weeks (e.g. 8, 10, 12)"
            value={local.weeks ?? ""}
            onChange={(e) =>
              setPref(
                "weeks",
                (e.target as HTMLInputElement).value
                  ? Number((e.target as HTMLInputElement).value)
                  : undefined
              )
            }
            inputMode="numeric"
          />
          <TextField
            placeholder="current best (hh:mm:ss)"
            value={local.targets?.run.current_best_time ?? ""}
            onChange={(e) =>
              upsertRunTargets({
                current_best_time: (e.target as HTMLInputElement).value || null,
              })
            }
          />
          <TextField
            placeholder="target time (hh:mm:ss)"
            value={local.targets?.run.target_time ?? ""}
            onChange={(e) =>
              upsertRunTargets({
                target_time: (e.target as HTMLInputElement).value || null,
              })
            }
          />
        </div>
      </section>

      {/* COACH PERSONALITY */}
      <section className={SECTION}>
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium opacity-90">
            Coach personality
          </div>
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

      {/* PLAN START */}
      <section className={SECTION}>
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium opacity-90">Plan start</div>
          <div className="text-xs opacity-70">Min: {MIN_PLAN_START()}</div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input
            type="date"
            value={local.start_date ?? ""}
            min={MIN_PLAN_START()}
            onChange={(e) => { markDirty(); setLocal(p => ({ ...p, start_date: (e.target as HTMLInputElement).value })); }}
            className={inputClass}
          />
          <Button
            variant="secondary"
            onClick={() => { markDirty(); setLocal(p => ({ ...p, start_date: DEFAULT_PLAN_START() })); }}
          >
            Set default (D+2)
          </Button>
          <Button
            variant="secondary"
            onClick={() => { markDirty(); setLocal(p => ({ ...p, start_date: MIN_PLAN_START() })); }}
          >
            Start tomorrow
          </Button>
        </div>
      </section>

      {/* SPORTS */}
      <section className={SECTION}>
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium opacity-90">Sports</div>
          <InfoPopover text="Choose main sport (or None). For others pick role and share %. Role 'None' hides it from planning." />
        </div>

        {/* Main sport (with None) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div>
            <div className="text-xs opacity-80 mb-1">Main sport</div>
            <select
              className={inputClass}
              value={mainSport}
              onChange={(e) => {
                const v = e.target.value as SportKind | "";
                setPref("main_sport", v === "" ? null : (v as SportKind));
                // when changing main → keep secondary list consistent
                const filtered = (local.secondary_mix ?? []).filter(
                  (s) => s.sport !== v
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
            const disableSlider = sec.role === "none" || sec.share_pct === 0;
            return (
              <div
                key={sec.sport}
                className={[SURFACE_INLINE, "px-3 py-2"].join(" ")}
              >
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="min-w-[80px] text-sm font-medium">
                    {sec.sport}
                  </div>

                  <div className="inline-flex items-center gap-1">
                    {(["none", "supplement", "improve"] as SecondaryRole[]).map(
                      (r) => {
                        const active = sec.role === r;
                        return (
                          <button
                            key={r}
                            type="button"
                            onClick={() =>
                              updateSecondary(sec.sport, {
                                role: r,
                                share_pct: r === "none" ? 0 : sec.share_pct,
                              })
                            }
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
                      }
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-1 min-w-[160px]">
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
                    <div className="w-12 text-right text-sm tabular-nums">
                      {sec.share_pct}%
                    </div>
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
                      title="Clear"
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
                      title="Reset 25%"
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

      {/* STRENGTH SETUP */}
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
              {(["gym","home","outdoor"] as const).map(loc => {
                const active = (local.strength_settings?.location ?? null) === loc;
                return (
                  <button
                    key={loc}
                    type="button"
                    onClick={()=>{
                      markDirty();
                      setLocal(p => ({ ...p, strength_settings: { ...(p.strength_settings ?? {}), location: active ? null : loc } }));
                    }}
                    className={[PILL_BUTTON, active ? ACTIVE_PILL : "border-white/15"].join(" ")}
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
              {(["none","bodyweight","minimal","full_gym"] as const).map(mode => {
                const active = (local.strength_settings?.equipment_mode ?? null) === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={()=>{
                      markDirty();
                      setLocal(p => ({ ...p, strength_settings: { ...(p.strength_settings ?? {}), equipment_mode: active ? null : mode } }));
                    }}
                    className={[PILL_BUTTON, active ? ACTIVE_PILL : "border-white/15"].join(" ")}
                  >
                    {mode}
                  </button>
                );
              })}
            </div>
          </div>

          {/* konkrétne kusy náradia */}
          <div>
            <div className="text-xs opacity-80 mb-1">Available gear</div>
            <div className="flex flex-wrap gap-2">
              {(["dumbbells","barbell","kettlebell","trx","pullup_bar","resistance_bands","bench","medicine_ball","sandbag","box"] as const).map(key => {
                const cur = local.strength_settings?.available ?? [];
                const active = cur.includes(key);
                const next = active ? cur.filter(k => k !== key) : [...cur, key];
                // ak je full_gym, tags sú len informatívne – necháme aj tak
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={()=>{
                      markDirty();
                      setLocal(p => ({ ...p, strength_settings: { ...(p.strength_settings ?? {}), available: next } }));
                    }}
                    className={[PILL_BUTTON, "text-xs", active ? ACTIVE_PILL : "border-white/15"].join(" ")}
                  >
                    {key}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* DAYS OFF */}
      <section className={SECTION}>
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium opacity-90">Days off</div>
          <InfoPopover text="Toggle any days. You can also select none." />
        </div>
        <div className="flex flex-wrap gap-2">
          {ALL_DAYS.map((d) => {
            const active = pref.days_off?.includes(d);
            const next = toggleInArray(pref.days_off, d);
            return (
              <button
                key={d}
                onClick={() => setPrefNested("preferences.days_off", next)}
                className={[
                  PILL_BUTTON,
                  active ? ACTIVE_PILL : "border-white/15",
                ].join(" ")}
              >
                {d}
              </button>
            );
          })}
        </div>
      </section>

      {/* LONG RUN DAYS */}
      <section className={SECTION}>
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium opacity-90">
            Preferred long-run days
          </div>
          <InfoPopover text="Pick preferred days (or none)." />
        </div>
        <div className="flex flex-wrap gap-2">
          {ALL_DAYS.map((d) => {
            const active = (pref.long_run_days ?? []).includes(d);
            const next = toggleInArray(pref.long_run_days ?? [], d);
            return (
              <button
                key={d}
                onClick={() => setPrefNested("preferences.long_run_days", next)}
                className={[
                  PILL_BUTTON,
                  active ? ACTIVE_PILL : "border-white/15",
                ].join(" ")}
              >
                {d}
              </button>
            );
          })}
        </div>
      </section>

      {/* RULES */}
      <section className={SECTION}>
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium opacity-90">Rules</div>
          <InfoPopover text="Base composition rules." />
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

      {/* ADVANCED TOGGLE */}
      <div className="flex">
        <button
          type="button"
          onClick={() => setShowAdv((s) => !s)}
          className={[PILL_BUTTON, "mx-auto"].join(" ")}
          aria-expanded={showAdv}
        >
          {showAdv ? "Hide advanced preferences" : "Show advanced preferences"}
        </button>
      </div>

      {showAdv && (
        <>
          {/* MODELS & BLOCKS */}
          <section className={SECTION}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium opacity-90">
                Intensity models & specific blocks
              </div>
              <InfoPopover text="Polarized/Pyramidal shape; VO₂max/FTP blocks." />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!(local as any).vo2max_training}
                  onChange={(e) =>
                    setPref("vo2max_training" as any, e.target.checked as any)
                  }
                />
                Include VO₂max blocks (run)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!(local as any).ftp_training}
                  onChange={(e) =>
                    setPref("ftp_training" as any, e.target.checked as any)
                  }
                />
                Include FTP blocks (ride)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!(local as any).threshold_focus}
                  onChange={(e) =>
                    setPref("threshold_focus" as any, e.target.checked as any)
                  }
                />
                Threshold focus (more Z3/Z4)
              </label>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className={[
                  PILL_BUTTON,
                  (local as any).polarized_model
                    ? ACTIVE_PILL
                    : "border-white/15",
                ].join(" ")}
                onClick={() => setPref("polarized_model" as any, true as any)}
              >
                Polarized (80/20)
              </button>
              <button
                className={[
                  PILL_BUTTON,
                  (local as any).pyramidal_model
                    ? ACTIVE_PILL
                    : "border-white/15",
                ].join(" ")}
                onClick={() => setPref("pyramidal_model" as any, true as any)}
              >
                Pyramidal
              </button>
              <button
                className={PILL_BUTTON}
                onClick={() =>
                  setLocal(
                    (p) =>
                      ({
                        ...p,
                        polarized_model: false,
                        pyramidal_model: false,
                      } as any)
                  )
                }
              >
                Clear model
              </button>
            </div>
          </section>

          {/* EXTERNAL ACTIVITIES */}
          <section className={SECTION}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium opacity-90">
                External activities (non-coach)
              </div>
              <InfoPopover text="Other sports like football; planner accounts for them." />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <select
                className={inputClass}
                value={extDraft.day}
                onChange={(e) =>
                  setExtDraft((d) => ({
                    ...d,
                    day: e.target.value as DayAbbrev,
                  }))
                }
              >
                {ALL_DAYS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <select
                className={inputClass}
                value={extDraft.sport}
                onChange={(e) =>
                  setExtDraft((d) => ({
                    ...d,
                    sport: e.target.value as ExternalSport,
                  }))
                }
              >
                {EXT_SPORTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select
                className={inputClass}
                value={extDraft.intensity}
                onChange={(e) =>
                  setExtDraft((d) => ({
                    ...d,
                    intensity: e.target.value as ExternalIntensity,
                  }))
                }
              >
                {EXT_INTENS.map((i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </select>
              <TextField
                placeholder="note (optional)"
                value={extDraft.note ?? ""}
                onChange={(e) =>
                  setExtDraft((d) => ({
                    ...d,
                    note: (e.target as HTMLInputElement).value,
                  }))
                }
              />
            </div>
            <div className="mt-2">
              <Button
                onClick={() => {
                  const cur = (local as any).external_activities ?? [];
                  setLocal(
                    (p) =>
                      ({
                        ...p,
                        external_activities: [
                          ...cur,
                          {
                            ...extDraft,
                            note: extDraft.note?.trim() || undefined,
                          },
                        ],
                      } as any)
                  );
                  markDirty();
                }}
                size="sm"
                variant="success"
              >
                Add external
              </Button>
            </div>

            {((local as any).external_activities ?? []).length > 0 && (
              <ul className="mt-3 space-y-2">
                {((local as any).external_activities ?? []).map(
                  (a: any, idx: number) => (
                    <li
                      key={idx}
                      className={[
                        SURFACE_INLINE,
                        "px-3 py-2 flex items-center justify-between",
                      ].join(" ")}
                    >
                      <span className="text-sm">
                        {a.day} · {a.sport} · {a.intensity}
                        {a.note ? ` — ${a.note}` : ""}
                      </span>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => {
                          const cur = (local as any).external_activities ?? [];
                          setLocal(
                            (p) =>
                              ({
                                ...p,
                                external_activities: cur.filter(
                                  (_: any, i: number) => i !== idx
                                ),
                              } as any)
                          );
                          markDirty();
                        }}
                      >
                        remove
                      </Button>
                    </li>
                  )
                )}
              </ul>
            )}
          </section>

          {/* INJURIES */}
          <section className={SECTION}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium opacity-90">
                Injuries / limitations
              </div>
              <InfoPopover text="Planner reduces risky elements and adds compensations." />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <select
                className={inputClass}
                value={injDraft.area}
                onChange={(e) =>
                  setInjDraft((d) => ({
                    ...d,
                    area: e.target.value as InjuryArea,
                  }))
                }
              >
                {INJ_AREAS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
              <select
                className={inputClass}
                value={injDraft.type}
                onChange={(e) =>
                  setInjDraft((d) => ({
                    ...d,
                    type: e.target.value as InjuryType,
                  }))
                }
              >
                {INJ_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <TextField
                placeholder="note (e.g., foot pain…)"
                value={injDraft.note ?? ""}
                onChange={(e) =>
                  setInjDraft((d) => ({
                    ...d,
                    note: (e.target as HTMLInputElement).value,
                  }))
                }
                containerClassName="md:col-span-2"
              />
            </div>
            <div className="mt-2">
              <Button
                onClick={() => {
                  const cur = (local as any).injuries ?? [];
                  setLocal(
                    (p) =>
                      ({
                        ...p,
                        injuries: [
                          ...cur,
                          {
                            ...injDraft,
                            note: injDraft.note?.trim() || undefined,
                          },
                        ],
                      } as any)
                  );
                  markDirty();
                }}
                size="sm"
                variant="success"
              >
                Add injury
              </Button>
            </div>

            {((local as any).injuries ?? []).length > 0 && (
              <ul className="mt-3 space-y-2">
                {((local as any).injuries ?? []).map((it: any, idx: number) => (
                  <li
                    key={idx}
                    className={[
                      SURFACE_INLINE,
                      "px-3 py-2 flex items-center justify-between",
                    ].join(" ")}
                  >
                    <span className="text-sm">
                      {it.area} · {it.type}
                      {it.note ? ` — ${it.note}` : ""}
                    </span>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => {
                        const cur = (local as any).injuries ?? [];
                        setLocal(
                          (p) =>
                            ({
                              ...p,
                              injuries: cur.filter(
                                (_: any, i: number) => i !== idx
                              ),
                            } as any)
                        );
                        markDirty();
                      }}
                    >
                      remove
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* FOCUS & AVOID */}
          <section className={SECTION}>
            <div className="text-xs opacity-80 mb-1">Focus areas</div>
            <div className="flex flex-wrap gap-2">
              {FOCUS_CHOICES.map((k) => {
                const cur = (local as any).focus_areas as string[] | undefined;
                const active = !!cur?.includes(k);
                const next = toggleInArray(cur, k);
                return (
                  <button
                    key={k}
                    onClick={() => {
                      setPref("focus_areas" as any, next as any);
                    }}
                    className={[
                      PILL_BUTTON,
                      active ? ACTIVE_PILL : "border-white/15",
                    ].join(" ")}
                  >
                    {k}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 text-xs opacity-80 mb-1">Avoid</div>
            <div className="flex flex-wrap gap-2">
              {AVOID_CHOICES.map((k) => {
                const cur = (local as any).avoid_zones as string[] | undefined;
                const active = !!cur?.includes(k);
                const next = toggleInArray(cur, k);
                return (
                  <button
                    key={k}
                    onClick={() => {
                      setPref("avoid_zones" as any, next as any);
                    }}
                    className={[
                      PILL_BUTTON,
                      active ? ACTIVE_PILL : "border-white/15",
                    ].join(" ")}
                  >
                    {k}
                  </button>
                );
              })}
            </div>
          </section>

          {/* REHAB */}
          <section className={SECTION}>
            <div className="text-sm font-medium opacity-90 mb-2">
              Rehab & recovery
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!(local as any).rehab_focus?.stretching}
                  onChange={(e) =>
                    setPref(
                      "rehab_focus" as any,
                      {
                        stretching: e.target.checked,
                        mobility: !!(local as any).rehab_focus?.mobility,
                        balance: !!(local as any).rehab_focus?.balance,
                        recovery_protocol:
                          (local as any).rehab_focus?.recovery_protocol ?? null,
                      } as RehabFocus
                    )
                  }
                />
                Stretching
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!(local as any).rehab_focus?.mobility}
                  onChange={(e) =>
                    setPref(
                      "rehab_focus" as any,
                      {
                        stretching: !!(local as any).rehab_focus?.stretching,
                        mobility: e.target.checked,
                        balance: !!(local as any).rehab_focus?.balance,
                        recovery_protocol:
                          (local as any).rehab_focus?.recovery_protocol ?? null,
                      } as RehabFocus
                    )
                  }
                />
                Mobility
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!(local as any).rehab_focus?.balance}
                  onChange={(e) =>
                    setPref(
                      "rehab_focus" as any,
                      {
                        stretching: !!(local as any).rehab_focus?.stretching,
                        mobility: !!(local as any).rehab_focus?.mobility,
                        balance: e.target.checked,
                        recovery_protocol:
                          (local as any).rehab_focus?.recovery_protocol ?? null,
                      } as RehabFocus
                    )
                  }
                />
                Balance/Proprioception
              </label>
              <TextField
                placeholder="protocol key (optional)"
                value={(local as any).rehab_focus?.recovery_protocol ?? ""}
                onChange={(e) =>
                  setPref(
                    "rehab_focus" as any,
                    {
                      stretching: !!(local as any).rehab_focus?.stretching,
                      mobility: !!(local as any).rehab_focus?.mobility,
                      balance: !!(local as any).rehab_focus?.balance,
                      recovery_protocol:
                        (e.target as HTMLInputElement).value || null,
                    } as RehabFocus
                  )
                }
              />
            </div>
          </section>
        </>
      )}

      {/* ACTIONS */}
      <div className="flex gap-2 pt-1">
        <Button onClick={onSave} variant="success">
          Save
        </Button>
        <Button onClick={onRefresh} variant="secondary">
          Refresh
        </Button>
      </div>
    </div>
  );
}
