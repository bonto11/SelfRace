// src/features/coach/components/prefs/PrefsForm.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CoachPrefs, SportKind, CoachPersona } from "@/features/coach/types/prefsTypes";
import type { DayAbbrev } from "@/shared/types/day";
import { useUserId } from "@/shared/hooks/useUserId";
import { toast } from "@/shared/components/ui/Toast";
import { readCoachPrefsFromStorage, refreshCoachPrefsFromDB, saveCoachPrefs } from "@/features/coach/utils/prefs";

import Button from "@/shared/components/ui/Button";
import { NO_X, PILL_BUTTON } from "@/shared/ui/classes";

import { fetchUserZonesLatest, saveUserZones } from "@/features/coach/api/zones";
import { fetchUserThresholdsLatest, saveUserThresholds } from "@/features/coach/api/thresholds";

import { GoalSection } from "@/features/coach/components/prefs/GoalSection";
import { CoachPersonalitySection } from "@/features/coach/components/prefs/CoachPersonalitySection";
import { PlanStartSection } from "@/features/coach/components/prefs/PlanStartSection";
import { SportsSection } from "@/features/coach/components/prefs/SportsSection";
import { StrengthSection } from "@/features/coach/components/prefs/StrengthSection";
import { DaysOffSection } from "@/features/coach/components/prefs/DaysOffSection";
import { LongRunDaysSection } from "@/features/coach/components/prefs/LongRunDaysSection";
import { RulesSection } from "@/features/coach/components/prefs/RulesSection";
import ZonesSection from "@/features/coach/components/prefs/ZonesSection";
import ThresholdsSection from "@/features/coach/components/prefs/ThresholdsSection";
import { IntensityModelsSection } from "@/features/coach/components/prefs/IntensityModelsSection";
import { ExternalActivitiesSection } from "@/features/coach/components/prefs/ExternalActivitiesSection";
import { InjuriesSection } from "@/features/coach/components/prefs/InjuriesSection";
import { FocusAvoidSection } from "@/features/coach/components/prefs/FocusAvoidSection";
import { RehabSection } from "@/features/coach/components/prefs/RehabSection";

/* ---- local DTOs ---- */
type SecondaryRole = "none" | "supplement" | "improve";
type SecondaryMix = { sport: SportKind; role: SecondaryRole; share_pct: number; };

type CoachPrefsExtended = CoachPrefs & {
  main_sport?: SportKind | null;
  secondary_mix?: SecondaryMix[];
  coach_voice?: CoachPersona | null;
  zones?: any;
  thresholds?: any;                // aktuálny draft prahov
  thresholds_latest?: any[] | null; // posledné uložené z BE (na preview/fallback)
};

const ALL_SPORTS: SportKind[] = ["run", "ride", "strength"];

function isoTodayPlus(days: number): string {
  const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const DEFAULT_PLAN_START = () => isoTodayPlus(2);
const MIN_PLAN_START = () => isoTodayPlus(1);

export default function PrefsForm() {
  const { userId } = useUserId();
  const dirtyRef = useRef(false);
  const markDirty = () => { dirtyRef.current = true; };

  const [local, setLocal] = useState<CoachPrefsExtended>(() => readCoachPrefsFromStorage() as CoachPrefsExtended);

  // initial load (prefs + zóny + latest thresholds list)
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      try {
        const [p, zones, thrRows] = await Promise.all([
          refreshCoachPrefsFromDB(userId),
          fetchUserZonesLatest(userId),            // najnovšie zóny (default sport)
          fetchUserThresholdsLatest(userId),       // surové riadky – použijeme na fallback LTHR
        ]);
        if (!alive) return;

        const next: CoachPrefsExtended = {
          ...(p as CoachPrefsExtended),
          zones: zones ?? (p as any)?.zones ?? null,
          thresholds: (p as any)?.thresholds ?? undefined,
          thresholds_latest: thrRows ?? null,
        };

        if (!dirtyRef.current) setLocal(next);
      } catch (e) {
        console.error("[CoachPrefs]init error", e);
      }
    })();
    return () => { alive = false; };
  }, [userId]);

  // start_date guard
  useEffect(() => {
    if (!local?.start_date) {
      setLocal((p) => ({ ...p, start_date: DEFAULT_PLAN_START() }));
    } else {
      const min = MIN_PLAN_START();
      if (local.start_date < min) setLocal((p) => ({ ...p, start_date: min }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const prefDefaults = (p: CoachPrefsExtended) =>
    p.preferences ?? { days_off: [], long_run_days: [], avoid_back_to_back_hard: true, use_zones: true, wu_cd_detail: true };

  const toggleInArray = <T,>(arr: T[] | undefined, v: T): T[] =>
    (arr ?? []).includes(v) ? (arr ?? []).filter((x) => x !== v) : [...(arr ?? []), v];

  const setPref = <K extends keyof CoachPrefsExtended>(key: K, val: CoachPrefsExtended[K]) => {
    markDirty(); setLocal((prev) => ({ ...prev, [key]: val }));
  };

  const setPrefNested = (path: "preferences.days_off" | "preferences.long_run_days", v: any) => {
    markDirty();
    const p = prefDefaults(local);
    const next = { ...local, preferences: p };
    if (path.endsWith("days_off")) next.preferences!.days_off = v as DayAbbrev[];
    if (path.endsWith("long_run_days")) next.preferences!.long_run_days = v as DayAbbrev[];
    setLocal(next);
  };

  const upsertRunTargets = (patch: Partial<NonNullable<CoachPrefsExtended["targets"]>["run"]>) => {
    markDirty();
    setLocal((prev) => ({
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

  // SAVE / REFRESH
  const onSave = async () => {
    if (!userId) return;
    try {
      const activeSecondaries = (local.secondary_mix ?? [])
        .filter((x) => x.role !== "none" && Number(x.share_pct) > 0)
        .map((x) => x.sport);
      const primaries = [...(local.main_sport ? [local.main_sport] : []), ...activeSecondaries];

      const minIso = MIN_PLAN_START();
      const startIso = (local.start_date ?? "").trim();
      const normalized: CoachPrefsExtended = {
        ...local,
        start_date: !startIso || startIso < minIso ? minIso : startIso,
        primary_sports: primaries.length ? primaries : undefined,
        secondary_mix: (local.secondary_mix ?? []).map((x) => (x.role === "none" ? { ...x, share_pct: 0 } : x)),
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
      const [fresh, zones, thrRows] = await Promise.all([
        refreshCoachPrefsFromDB(userId),
        fetchUserZonesLatest(userId),
        fetchUserThresholdsLatest(userId),
      ]);
      const next: CoachPrefsExtended = {
        ...(fresh as CoachPrefsExtended),
        zones: zones ?? (fresh as any)?.zones ?? null,
        thresholds_latest: thrRows ?? null,
      };
      if (!dirtyRef.current) setLocal(next);
      toast.success("Refreshed");
    } catch (e: any) {
      console.error("[CoachPrefs]refresh error", e);
      toast.error(String(e?.message ?? e));
    }
  };

  const pref = prefDefaults(local);
  const [showAdv, setShowAdv] = useState(false);

  /* -------- Sports (main + secondary) -------- */
  const mainSport: SportKind | "" = (local.main_sport ?? "") as any;
  const secondary: SecondaryMix[] = useMemo(() => {
    const cur = (local.secondary_mix ?? []).filter((s) => s.sport !== local.main_sport);
    const missing = ALL_SPORTS.filter((s) => s !== local.main_sport)
      .filter((s) => !cur.some((x) => x.sport === s))
      .map<SecondaryMix>((s) => ({ sport: s, role: "none", share_pct: 0 }));
    return [...cur, ...missing];
  }, [local.secondary_mix, local.main_sport]);
  const setSecondary = (mix: SecondaryMix[]) => { markDirty(); setLocal((p) => ({ ...p, secondary_mix: mix })); };
  const updateSecondary = (sport: SportKind, patch: Partial<SecondaryMix>) => {
    const next = secondary.map((x) => (x.sport === sport ? { ...x, ...patch } : x));
    setSecondary(next);
  };
  const sumShare = secondary.reduce((a, b) => a + (Number.isFinite(b.share_pct) ? b.share_pct : 0), 0);
  const shareWarn = sumShare > 100;

  /* -------- Zones / Thresholds handlers -------- */
  const handleZonesChange = (z: any) => { setLocal((prev) => ({ ...prev, zones: z })); markDirty(); };
  const handleSaveZonesToDB = async (z: any) => {
    if (!userId) return;
    try {
      const saved = await saveUserZones(userId, z ?? {});
      setLocal((prev) => ({ ...prev, zones: saved ?? z }));
      toast.success("Zones saved to DB");
    } catch (e) { console.error(e); toast.error("Saving zones failed"); }
  };

  const handleThresholdsChange = (t: any) => { setLocal((prev) => ({ ...prev, thresholds: t })); markDirty(); };
  const handleSaveThresholdsToDB = async (t: any) => {
    if (!userId) return;
    try {
      const saved = await saveUserThresholds(userId, t ?? {});
      setLocal((prev) => ({ ...prev, thresholds: { ...t, ...(saved ?? {}) } }));
      toast.success("Threshold saved to DB");
    } catch (e) { console.error(e); toast.error("Saving threshold failed"); }
  };

  // LTHR pre zónový výpočet: uprednostni aktuálny draft; inak posledný uložený LT2 HR
  const lthrBpm: number | null = useMemo(() => {
    const draft = Number(local?.thresholds?.HR_bpm);
    if (Number.isFinite(draft) && draft > 0) return draft;
    const rows = (local.thresholds_latest ?? []) as any[];
    const lt2 = rows.find((r) => String(r.threshold_type).toUpperCase() === "LT2");
    return lt2?.hr_bpm ?? null;
  }, [local?.thresholds?.HR_bpm, local.thresholds_latest]);

  return (
    <div className={["space-y-4", NO_X].join(" ")}>
      <PlanStartSection local={local} setLocal={setLocal} markDirty={markDirty} />
      <GoalSection local={local} setPref={setPref} upsertRunTargets={upsertRunTargets} />

      <SportsSection
        local={local}
        mainSport={mainSport}
        secondary={secondary}
        shareWarn={shareWarn}
        setPref={setPref}
        updateSecondary={updateSecondary}
      />

      <StrengthSection local={local} setLocal={setLocal} markDirty={markDirty} />
      <DaysOffSection daysOff={pref.days_off} toggleInArray={toggleInArray} setPrefNested={setPrefNested} />
      <LongRunDaysSection longRunDays={pref.long_run_days} toggleInArray={toggleInArray} setPrefNested={setPrefNested} />
      <RulesSection pref={pref} prefDefaults={prefDefaults} setLocal={setLocal} markDirty={markDirty} />

      {/* Zones – s LTHR pre %LTHR režim */}
      <ZonesSection
        zones={local.zones}
        /*lthrBpm={lthrBpm}*/
        lthrBpm={180}
        onZonesChange={handleZonesChange}
        onSaveZonesToDB={handleSaveZonesToDB}
      />

      {/* Thresholds – samostatne */}
      <ThresholdsSection
        thresholds={local.thresholds}
        latestList={local.thresholds_latest ?? []}
        onChange={handleThresholdsChange}
        onSaveToDB={handleSaveThresholdsToDB}
      />

      <CoachPersonalitySection local={local} setPref={setPref} markDirty={markDirty} />

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
          <IntensityModelsSection local={local} setLocal={setLocal} setPref={setPref} />
          <ExternalActivitiesSection local={local} setLocal={setLocal} />
          <InjuriesSection local={local} setLocal={setLocal} />
          <FocusAvoidSection local={local} setPref={setPref} toggleInArray={toggleInArray} />
          <RehabSection local={local} setPref={setPref} />
        </>
      )}

      <div className="flex gap-2 pt-1">
        <Button onClick={onSave} variant="success">Save</Button>
        <Button onClick={onRefresh} variant="secondary">Refresh</Button>
      </div>
    </div>
  );
}