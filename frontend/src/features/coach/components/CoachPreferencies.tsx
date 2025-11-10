// src/features/coach/components/CoachPreferencies/index.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  CoachPrefs, GoalKind, SportKind,
  CoachPersona,
  ExternalActivity, ExternalIntensity, ExternalSport,
  Injury, InjuryArea, InjuryType,
  RehabFocus
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

/* ===== Rozšírenia PREFS (nekolidujú so starými) ======================= */
type SecondaryRole = "supplement" | "improve";
type SecondaryMix = { sport: SportKind; role: SecondaryRole; share_pct: number };

type CoachPrefsExtended = CoachPrefs & {
  main_sport?: SportKind | null;
  secondary_mix?: SecondaryMix[];
  coach_voice?: CoachPersona;
  coach_tone?: { directness: number; praise: number; challenge: number; emoji: number; explain: number };
};

/* ===== Konštanty ======================================================= */
const ALL_DAYS: DayAbbrev[] = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const ALL_SPORTS: SportKind[] = ["run","ride","strength"];
const ALL_GOALS: GoalKind[] = ["race_time","improve_speed","improve_endurance","improve_overall","maintain"];

const EXT_SPORTS: ExternalSport[] = ["football","run","ride","strength","other"];
const EXT_INTENS: ExternalIntensity[] = ["low","moderate","high"];
const INJ_AREAS: InjuryArea[] = ["foot","ankle","shin","knee","hip","hamstring","calf","back","shoulder","other"];
const INJ_TYPES: InjuryType[]  = ["overuse","acute","tendon","stress","shin_splints","plantar","itb","other"];
const FOCUS_CHOICES = [
  "ankle_strength","foot_intrinsics","calf_strength","hamstrings",
  "glutes","core_stability","thoracic_mobility","shoulder_stability"
];
const AVOID_CHOICES = ["impact_high","downhill_runs","hard_surfaces","back_to_back_speed"];

const ACTIVE_PILL =
  "bg-emerald-600/90 border-emerald-500 text-white shadow-[inset_0_0_0_2px_rgba(16,185,129,.25)]";

/* ===== Mini InfoPopover (ikonka „i“) ================================== */
function InfoPopover({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="px-2 py-1 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-xs"
        aria-expanded={open}
        aria-label="Info"
        title="Info"
      >
        i
      </button>
      {open && (
        <div
          className={[
            SURFACE_INSET,
            "absolute right-0 mt-2 w-[min(74vw,360px)] p-3 text-xs leading-snug z-30",
          ].join(" ")}
          role="note"
        >
          {text}
        </div>
      )}
    </div>
  );
}

/* ===== Komponent ======================================================= */
export default function PrefsForm() {
  const { userId } = useUserId();

  // --- Anti-overwrite guard: ak používateľ práve mení UI, ignoruj neskorý fetch ---
  const dirtyRef = useRef(false);
  const markDirty = () => { dirtyRef.current = true; };

  // init z LS + (oneshot) DB
  const [local, setLocal] = useState<CoachPrefsExtended>(() => readCoachPrefsFromStorage() as CoachPrefsExtended);
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      try {
        const p = (await refreshCoachPrefsFromDB(userId)) as CoachPrefsExtended;
        if (!alive) return;
        if (!dirtyRef.current) setLocal(p); // kľúčová zmena: neprepíšeme práve klikané voľby
      } catch {/* ignore */}
    })();
    return () => { alive = false; };
  }, [userId]);

  // defaults preferences
  const prefDefaults = (p: CoachPrefsExtended) =>
    p.preferences ?? {
      days_off: [],
      long_run_days: [],
      avoid_back_to_back_hard: true,
      use_zones: true,
      wu_cd_detail: true,
    };

  const toggleInArray = <T,>(arr: T[] | undefined, v: T): T[] => {
    const base = arr ?? [];
    return base.includes(v) ? base.filter(x => x !== v) : [...base, v];
  };

  const setPref = <K extends keyof CoachPrefsExtended>(key: K, val: CoachPrefsExtended[K]) => {
    markDirty();
    setLocal(prev => ({ ...prev, [key]: val }));
  };

  const setPrefNested = (
    path: "preferences.days_off" | "preferences.long_run_days",
    v: any
  ) => {
    markDirty();
    const p = prefDefaults(local);
    const next = { ...local, preferences: p };
    if (path.endsWith("days_off")) next.preferences!.days_off = v as DayAbbrev[];
    if (path.endsWith("long_run_days")) next.preferences!.long_run_days = v as DayAbbrev[];
    setLocal(next);
  };

  const upsertRunTargets = (
    patch: Partial<NonNullable<CoachPrefsExtended["targets"]>["run"]>
  ) => {
    markDirty();
    setLocal(prev => ({
      ...prev,
      targets: {
        run: {
          race_goal: prev.targets?.run?.race_goal ?? null,
          current_best_time: prev.targets?.run?.current_best_time ?? null,
          target_time: prev.targets?.run?.target_time ?? null,
          longest_recent_distance_km: prev.targets?.run?.longest_recent_distance_km ?? null,
          ...patch,
        },
        ride: prev.targets?.ride ?? { focus: "endurance", weekly_time_target_min: null },
        strength: prev.targets?.strength ?? { focus: "general", sessions_per_week: 2 },
      },
    }));
  };

  const onSave = async () => {
  if (!userId) return;
  try {
    // normalizácia podľa nového modelu
    const ms = (local.main_sport as any) || local.primary_sports?.[0] || "run";
    const sec = (local.secondary_mix ?? [])
      .filter((x: any) => Number(x?.share_pct) > 0)
      .map((x: any) => x.sport);

    const normalized = {
      ...local,
      main_sport: ms,
      // nech primary_sports odráža aktuálne aktívne športy
      primary_sports: [ms, ...sec],
      // voliteľne: ukladaj len aktívne sekundárne
      secondary_mix: (local.secondary_mix ?? []).filter((x: any) => Number(x?.share_pct) > 0),
    };

    await saveCoachPrefs(userId, normalized);
    toast.success("Preferences saved");
  } catch (e: any) {
    toast.error(String(e?.message ?? e));
  }
};

  const onRefresh = async () => {
    if (!userId) return;
    try {
      const fresh = (await refreshCoachPrefsFromDB(userId)) as CoachPrefsExtended;
      if (!dirtyRef.current) setLocal(fresh);
      toast.success("Refreshed");
    } catch (e: any) {
      toast.error(String(e?.message ?? e));
    }
  };

  const pref = prefDefaults(local);
  const [showAdv, setShowAdv] = useState(false);

  /* --------- Hlavný & doplnkové športy ---------- */
  const mainSport = useMemo<SportKind>(() => (local.main_sport as SportKind) || "run", [local.main_sport]);

  const secondary = useMemo<SecondaryMix[]>(() => {
    const cur = (local.secondary_mix ?? []).filter(s => s.sport !== mainSport);
    const missing = ALL_SPORTS
      .filter(s => s !== mainSport)
      .filter(s => !cur.some(x => x.sport === s))
      .map<SecondaryMix>(s => ({ sport: s, role: "supplement", share_pct: 25 }));
    return [...cur, ...missing];
  }, [local.secondary_mix, mainSport]);

  const setSecondary = (mix: SecondaryMix[]) => { markDirty(); setLocal(p => ({ ...p, secondary_mix: mix })); };
  const updateSecondary = (sport: SportKind, patch: Partial<SecondaryMix>) => {
    const next = secondary.map(x => (x.sport === sport ? { ...x, ...patch } : x));
    setSecondary(next);
  };

  const sumShare = secondary.reduce((a, b) => a + (Number.isFinite(b.share_pct) ? b.share_pct : 0), 0);
  const shareWarn = sumShare > 100;

  /* --------- Externé aktivity / zranenia (advanced) ---------- */
  const [extDraft, setExtDraft] = useState<ExternalActivity>({ day: "Tue", sport: "football", intensity: "high", note: "" });
  const [injDraft, setInjDraft] = useState<Injury>({ area: "foot", type: "overuse", note: "bolesť nártov po dlhých behoch" });

  const addExternal = () => {
    markDirty();
    const cur = (local as any).external_activities ?? [];
    setLocal(p => ({ ...p, external_activities: [...cur, { ...extDraft, note: extDraft.note?.trim() || undefined }] } as any));
  };
  const removeExternal = (idx: number) => {
    markDirty();
    const cur = (local as any).external_activities ?? [];
    setLocal(p => ({ ...p, external_activities: cur.filter((_: any, i: number) => i !== idx) } as any));
  };

  const addInjury = () => {
    markDirty();
    const cur = (local as any).injuries ?? [];
    setLocal(p => ({ ...p, injuries: [...cur, { ...injDraft, note: injDraft.note?.trim() || undefined }] } as any));
  };
  const removeInjury = (idx: number) => {
    markDirty();
    const cur = (local as any).injuries ?? [];
    setLocal(p => ({ ...p, injuries: cur.filter((_: any, i: number) => i !== idx) } as any));
  };

  /* --------- Personalita trénera ---------- */
  const personas: { key: CoachPersona; label: string; hint: string }[] = [
    { key: "kapral",   label: "Kaprál (Oldschooler)", hint: "Prísny drill, direktívny tón, minimum emócií." },
    { key: "hecovac",  label: "Hecovač (Parťák)",     hint: "Podporný, pozitívny, občas emoji." },
    { key: "statistik",label: "Štatistik (Inžinier)", hint: "Vecný, analytický, čísla > dojmy." },
    { key: "realista", label: "Realista (Bez cukru)", hint: "Úprimný challenge, nikdy toxický." },
  ];

  const tone = local.coach_tone ?? { directness: 50, praise: 50, challenge: 50, emoji: 20, explain: 60 };

  return (
    <div className={["space-y-4", NO_X].join(" ")}>

      {/* ====== GOAL ====== */}
      <section className={SECTION}>
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium opacity-90">Goal</div>
          <InfoPopover text="Vyber celkový cieľ prípravy a časové okno. Pri 'race_time' uveď aj súčasné a cieľové časy pre beh." />
        </div>

        <div className="flex flex-wrap gap-2">
          {ALL_GOALS.map(g => {
            const active = local.goal_kind === g;
            return (
              <button
                key={g}
                onClick={() => setPref("goal_kind", g)}
                className={[
                  PILL_BUTTON,
                  active ? ACTIVE_PILL : "border-white/15"
                ].join(" ")}
              >
                {g}
              </button>
            );
          })}
        </div>

        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
          <TextField
            placeholder="weeks (e.g. 8, 10, 12)"
            value={local.weeks ?? ""}
            onChange={(e) =>
              setPref("weeks", (e.target as HTMLInputElement).value
                ? Number((e.target as HTMLInputElement).value)
                : undefined)
            }
            inputMode="numeric"
          />
          <TextField
            placeholder="current best (hh:mm:ss)"
            value={local.targets?.run.current_best_time ?? ""}
            onChange={(e) => upsertRunTargets({ current_best_time: (e.target as HTMLInputElement).value || null })}
          />
          <TextField
            placeholder="target time (hh:mm:ss)"
            value={local.targets?.run.target_time ?? ""}
            onChange={(e) => upsertRunTargets({ target_time: (e.target as HTMLInputElement).value || null })}
          />
        </div>
      </section>

      {/* ====== PERSONALITA TRÉNERA ====== */}
      <section className={SECTION}>
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium opacity-90">Coach personality</div>
          <InfoPopover text="Vyber štýl komunikácie trénera. Nižšie môžeš doladiť tón (directness/praise/challenge/emoji/explain)." />
        </div>

        <div className="flex flex-wrap gap-2">
          {personas.map(p => {
            const active = local.coach_voice === p.key;
            return (
              <button
                key={p.key}
                onClick={() => setPref("coach_voice", p.key)}
                title={p.hint}
                className={[PILL_BUTTON, active ? ACTIVE_PILL : "border-white/15"].join(" ")}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* sliders */}
        <div className="mt-3 grid grid-cols-1 md:grid-cols-5 gap-3">
          {[
            { key: "directness", label: "Directness" },
            { key: "praise",     label: "Praise" },
            { key: "challenge",  label: "Challenge" },
            { key: "emoji",      label: "Emoji" },
            { key: "explain",    label: "Explanations" },
          ].map(it => (
            <div key={it.key} className={SURFACE_INLINE + " px-3 py-2"}>
              <div className="text-xs opacity-80 mb-1">{it.label}</div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={(tone as any)[it.key]}
                  onChange={(e) => setPref("coach_tone", { ...tone, [it.key]: Number(e.target.value) })}
                  className="flex-1 accent-emerald-500"
                />
                <div className="w-10 text-right text-xs tabular-nums">{(tone as any)[it.key]}%</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ====== ŠPORTY: hlavný + doplnkové ====== */}
      <section className={SECTION}>
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium opacity-90">Sports</div>
          <InfoPopover text="Zvoľ hlavný šport. Ostatné nastav ako doplnkové: ich podiel je % tréningovej energie mimo hlavného. 'Supplement' = udržiavanie, 'Improve' = aktívne zlepšovať." />
        </div>

        {/* Hlavný šport */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div>
            <div className="text-xs opacity-80 mb-1">Main sport</div>
            <select
              className={inputClass}
              value={mainSport}
              onChange={(e) => {
                const ms = e.target.value as SportKind;
                setPref("main_sport", ms);
                const filtered = (local.secondary_mix ?? []).filter(s => s.sport !== ms);
                setPref("secondary_mix", filtered as any);
              }}
            >
              {ALL_SPORTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Sumár podielov */}
          <div className="sm:col-span-2">
            <div className="text-xs opacity-80 mb-1">Secondary share (sum)</div>
            <div className={[
              SURFACE_INLINE,
              "px-3 py-2 text-sm font-semibold tabular-nums",
              shareWarn ? "text-rose-300" : "opacity-90"
            ].join(" ")}>
              {sumShare}% {shareWarn ? "— reduce below 100%" : ""}
            </div>
          </div>
        </div>

        {/* Doplnkové športy */}
        <div className="mt-3 grid grid-cols-1 gap-2">
          {secondary.map(sec => (
            <div key={sec.sport} className={[SURFACE_INLINE, "px-3 py-2"].join(" ")}>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="min-w-[80px] text-sm font-medium">{sec.sport}</div>

                <div className="inline-flex items-center gap-1">
                  {(["supplement","improve"] as SecondaryRole[]).map(r => {
                    const active = sec.role === r;
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => updateSecondary(sec.sport, { role: r })}
                        className={[PILL_BUTTON, "text-xs px-2 py-1", active ? ACTIVE_PILL : "border-white/15"].join(" ")}
                        title={r === "supplement" ? "doplnok/udržiavať" : "cieľ zlepšiť"}
                      >
                        {r}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2 flex-1 min-w-[160px]">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={sec.share_pct}
                    onChange={(e) => updateSecondary(sec.sport, { share_pct: Number(e.target.value) })}
                    className="flex-1 accent-emerald-500"
                  />
                  <div className="w-12 text-right text-sm tabular-nums">{sec.share_pct}%</div>
                </div>

                <div className="ml-auto">
                  <button
                    type="button"
                    onClick={() => updateSecondary(sec.sport, { share_pct: 25, role: "supplement" })}
                    className={[PILL_BUTTON, "text-xs px-2 py-1"].join(" ")}
                    title="Reset to 25% / supplement"
                  >
                    reset
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ====== Days off ====== */}
      <section className={SECTION}>
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium opacity-90">Days off</div>
          <InfoPopover text="Dni bez tréningu od trénera (môžeš mať ľahký voľný pohyb)." />
        </div>

        <div className="flex flex-wrap gap-2">
          {ALL_DAYS.map(d => {
            const active = pref.days_off?.includes(d);
            const next = toggleInArray(pref.days_off, d);
            return (
              <button
                key={d}
                onClick={() => setPrefNested("preferences.days_off", next)}
                className={[PILL_BUTTON, active ? ACTIVE_PILL : "border-white/15"].join(" ")}
              >
                {d}
              </button>
            );
          })}
        </div>
      </section>

      {/* ====== Long-run dni ====== */}
      <section className={SECTION}>
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium opacity-90">Preferred long-run days</div>
          <InfoPopover text="Dni, kedy ti najviac vyhovuje dlhší beh/jazda." />
        </div>

        <div className="flex flex-wrap gap-2">
          {ALL_DAYS.map(d => {
            const active = (pref.long_run_days ?? []).includes(d);
            const next = toggleInArray(pref.long_run_days ?? [], d);
            return (
              <button
                key={d}
                onClick={() => setPrefNested("preferences.long_run_days", next)}
                className={[PILL_BUTTON, active ? ACTIVE_PILL : "border-white/15"].join(" ")}
              >
                {d}
              </button>
            );
          })}
        </div>
      </section>

      {/* ====== Pravidlá ====== */}
      <section className={SECTION}>
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium opacity-90">Rules</div>
          <InfoPopover text="Základné pravidlá skladby tréningov." />
        </div>

        <div className={FORM_GRID_TWO}>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!pref.avoid_back_to_back_hard}
              onChange={(e) =>
                setLocal(prev => ({
                  ...prev,
                  preferences: { ...prefDefaults(prev), avoid_back_to_back_hard: e.target.checked },
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
                  setLocal(prev => ({
                    ...prev,
                    preferences: { ...prefDefaults(prev), use_zones: e.target.checked },
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
                  setLocal(prev => ({
                    ...prev,
                    preferences: { ...prefDefaults(prev), wu_cd_detail: e.target.checked },
                  }))
                }
                onInput={markDirty}
              />
              Include WU/CD details
            </label>
          </div>
        </div>
      </section>

      {/* ====== Advanced toggle ====== */}
      <div className="flex">
        <button
          type="button"
          onClick={() => setShowAdv(s => !s)}
          className={[PILL_BUTTON, "mx-auto"].join(" ")}
          aria-expanded={showAdv}
        >
          {showAdv ? "Hide advanced preferences" : "Show advanced preferences"}
        </button>
      </div>

      {showAdv && (
        <>
          {/* Modely / špecifické bloky */}
          <section className={SECTION}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium opacity-90">Intensity models & specific blocks</div>
              <InfoPopover text="Polarized/Pyramidal ovplyvní rozloženie intenzít. VO₂max/FTP zapne cielené bloky." />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!(local as any).vo2max_training}
                  onChange={(e) => setPref("vo2max_training" as any, e.target.checked as any)}
                />
                Include VO₂max blocks (run)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!(local as any).ftp_training}
                  onChange={(e) => setPref("ftp_training" as any, e.target.checked as any)}
                />
                Include FTP blocks (ride)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!(local as any).threshold_focus}
                  onChange={(e) => setPref("threshold_focus" as any, e.target.checked as any)}
                />
                Threshold focus (more Z3/Z4)
              </label>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className={[PILL_BUTTON, (local as any).polarized_model ? ACTIVE_PILL : "border-white/15"].join(" ")}
                onClick={() => setPref("polarized_model" as any, true as any)}
              >
                Polarized (80/20)
              </button>
              <button
                className={[PILL_BUTTON, (local as any).pyramidal_model ? ACTIVE_PILL : "border-white/15"].join(" ")}
                onClick={() => setPref("pyramidal_model" as any, true as any)}
              >
                Pyramidal
              </button>
              <button
                className={PILL_BUTTON}
                onClick={() => setLocal(p => ({ ...p, polarized_model: false, pyramidal_model: false } as any))}
              >
                Clear model
              </button>
            </div>
          </section>

          {/* Externé aktivity */}
          <section className={SECTION}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium opacity-90">External activities (non-coach)</div>
              <InfoPopover text="Aktivity mimo trénera (napr. futbal). Plán s nimi počíta pri rozklade záťaže." />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <select className={inputClass} value={extDraft.day}
                onChange={(e) => setExtDraft(d => ({ ...d, day: e.target.value as DayAbbrev }))}>
                {ALL_DAYS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <select className={inputClass} value={extDraft.sport}
                onChange={(e) => setExtDraft(d => ({ ...d, sport: e.target.value as ExternalSport }))}>
                {EXT_SPORTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select className={inputClass} value={extDraft.intensity}
                onChange={(e) => setExtDraft(d => ({ ...d, intensity: e.target.value as ExternalIntensity }))}>
                {EXT_INTENS.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
              <TextField
                placeholder="note (optional)"
                value={extDraft.note ?? ""}
                onChange={(e) => setExtDraft(d => ({ ...d, note: (e.target as HTMLInputElement).value }))}
              />
            </div>
            <div className="mt-2">
              <Button onClick={addExternal} size="sm" variant="success">Add external</Button>
            </div>

            {((local as any).external_activities ?? []).length > 0 && (
              <ul className="mt-3 space-y-2">
                {((local as any).external_activities ?? []).map((a: any, idx: number) => (
                  <li key={idx} className={[SURFACE_INLINE, "px-3 py-2 flex items-center justify-between"].join(" ")}>
                    <span className="text-sm">
                      {a.day} · {a.sport} · {a.intensity}{a.note ? ` — ${a.note}` : ""}
                    </span>
                    <Button size="sm" variant="danger" onClick={() => removeExternal(idx)}>remove</Button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Zranenia */}
          <section className={SECTION}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium opacity-90">Injuries / limitations</div>
              <InfoPopover text="Zdravotné obmedzenia (napr. bolesť nártov). Plán zníži rizikové prvky a zaradí kompenzácie." />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <select className={inputClass} value={injDraft.area}
                onChange={(e) => setInjDraft(d => ({ ...d, area: e.target.value as InjuryArea }))}>
                {INJ_AREAS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <select className={inputClass} value={injDraft.type}
                onChange={(e) => setInjDraft(d => ({ ...d, type: e.target.value as InjuryType }))}>
                {INJ_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <TextField
                placeholder="note (e.g., bolesť nártov…)"
                value={injDraft.note ?? ""}
                onChange={(e) => setInjDraft(d => ({ ...d, note: (e.target as HTMLInputElement).value }))}
                containerClassName="md:col-span-2"
              />
            </div>
            <div className="mt-2">
              <Button onClick={addInjury} size="sm" variant="success">Add injury</Button>
            </div>

            {((local as any).injuries ?? []).length > 0 && (
              <ul className="mt-3 space-y-2">
                {((local as any).injuries ?? []).map((it: any, idx: number) => (
                  <li key={idx} className={[SURFACE_INLINE, "px-3 py-2 flex items-center justify-between"].join(" ")}>
                    <span className="text-sm">
                      {it.area} · {it.type}{it.note ? ` — ${it.note}` : ""}
                    </span>
                    <Button size="sm" variant="danger" onClick={() => removeInjury(idx)}>remove</Button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Fokus & Avoid */}
          <section className={SECTION}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium opacity-90">Focus & Avoid</div>
              <InfoPopover text="Zameranie na slabiny (strength/mobility) a veci, ktorým sa má plán vyhýbať (napr. veľa zbehov)." />
            </div>

            <div className="text-xs opacity-80 mb-1">Focus areas</div>
            <div className="flex flex-wrap gap-2">
              {FOCUS_CHOICES.map(k => {
                const cur = (local as any).focus_areas as string[] | undefined;
                const active = !!cur?.includes(k);
                const next = toggleInArray(cur, k);
                return (
                  <button
                    key={k}
                    onClick={() => setPref("focus_areas" as any, next as any)}
                    className={[PILL_BUTTON, active ? ACTIVE_PILL : "border-white/15"].join(" ")}
                  >
                    {k}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 text-xs opacity-80 mb-1">Avoid</div>
            <div className="flex flex-wrap gap-2">
              {AVOID_CHOICES.map(k => {
                const cur = (local as any).avoid_zones as string[] | undefined;
                const active = !!cur?.includes(k);
                const next = toggleInArray(cur, k);
                return (
                  <button
                    key={k}
                    onClick={() => setPref("avoid_zones" as any, next as any)}
                    className={[PILL_BUTTON, active ? ACTIVE_PILL : "border-white/15"].join(" ")}
                  >
                    {k}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Rehab */}
          <section className={SECTION}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium opacity-90">Rehab & recovery</div>
              <InfoPopover text="Dlhodobejšie kompenzácie – stretching/mobility/balance a prípadný protokol (kľúč)." />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!(local as any).rehab_focus?.stretching}
                  onChange={(e) =>
                    setPref("rehab_focus" as any, {
                      stretching: e.target.checked,
                      mobility: !!(local as any).rehab_focus?.mobility,
                      balance: !!(local as any).rehab_focus?.balance,
                      recovery_protocol: (local as any).rehab_focus?.recovery_protocol ?? null
                    } as RehabFocus)
                  }
                />
                Stretching
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!(local as any).rehab_focus?.mobility}
                  onChange={(e) =>
                    setPref("rehab_focus" as any, {
                      stretching: !!(local as any).rehab_focus?.stretching,
                      mobility: e.target.checked,
                      balance: !!(local as any).rehab_focus?.balance,
                      recovery_protocol: (local as any).rehab_focus?.recovery_protocol ?? null
                    } as RehabFocus)
                  }
                />
                Mobility
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!(local as any).rehab_focus?.balance}
                  onChange={(e) =>
                    setPref("rehab_focus" as any, {
                      stretching: !!(local as any).rehab_focus?.stretching,
                      mobility: !!(local as any).rehab_focus?.mobility,
                      balance: e.target.checked,
                      recovery_protocol: (local as any).rehab_focus?.recovery_protocol ?? null
                    } as RehabFocus)
                  }
                />
                Balance/Proprioception
              </label>
              <TextField
                placeholder="protocol key (optional)"
                value={(local as any).rehab_focus?.recovery_protocol ?? ""}
                onChange={(e) =>
                  setPref("rehab_focus" as any, {
                    stretching: !!(local as any).rehab_focus?.stretching,
                    mobility: !!(local as any).rehab_focus?.mobility,
                    balance: !!(local as any).rehab_focus?.balance,
                    recovery_protocol: (e.target as HTMLInputElement).value || null
                  } as RehabFocus)
                }
              />
            </div>
          </section>
        </>
      )}

      {/* Akcie */}
      <div className="flex gap-2 pt-1">
        <Button onClick={onSave} variant="success">Save</Button>
        <Button onClick={onRefresh} variant="secondary">Refresh</Button>
      </div>
    </div>
  );
}