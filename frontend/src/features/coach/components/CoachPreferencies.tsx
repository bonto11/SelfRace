// src/features/coach/components/prefs/CoachPreferencies.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  CoachPrefs,
  SportKind,
  CoachPersona,
  RunTargets,
  SecondaryMix,
} from "@/features/prefs/types/prefs";
import type { DayAbbrev } from "@/shared/types/day";
import { useUserId } from "@/shared/hooks/useUserId";
import { toast } from "@/shared/components/ui/Toast";
import {
  refreshCoachPrefsFromDB,
  saveCoachPrefs,
} from "@/features/coach/utils/prefs";

import Button from "@/shared/components/ui/Button";
import { NO_X, PILL_BUTTON } from "@/shared/ui/classes";

import {
  apiFetchUserZonesLatest,
  apiSaveUserZones,
} from "@/features/coach/api/zones";
import {
  apiFetchUserThresholdsLatest,
  apiSaveUserThresholds,
} from "@/features/coach/api/thresholds";

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
import { InjuriesSection } from "@/features/coach/components/prefs/InjuriesSection";
import { FocusAvoidSection } from "@/features/coach/components/prefs/FocusAvoidSection";
import { RehabSection } from "@/features/coach/components/prefs/RehabSection";
import { VolumeSection } from "@/features/coach/components/prefs/VolumeSection";

/* ---- local DTOs ---- */

type CoachPrefsExtended = CoachPrefs & {
  main_sport?: SportKind | null;
  secondary_mix?: SecondaryMix[];
  coach_voice?: CoachPersona | null;
  // runtime-only – neukladá sa do coach.prefs v DB
  zones?: any;
  thresholds?: any;
  thresholds_latest?: any[] | null;
};

const ALL_SPORTS: SportKind[] = ["run", "ride", "strength", "swim"];

function isoTodayPlus(days: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
}
const DEFAULT_PLAN_START = () => isoTodayPlus(2);
const MIN_PLAN_START = () => isoTodayPlus(1);

export default function CoachPreferencies() {
  const { userId } = useUserId();
  const dirtyRef = useRef(false);
  const markDirty = () => {
    dirtyRef.current = true;
  };

  const [local, setLocal] = useState<CoachPrefsExtended>(
    {} as CoachPrefsExtended
  );

  // initial load (prefs + zones + latest thresholds) – všetko z DB
  useEffect(() => {
    if (!userId) return;
    let alive = true;

    (async () => {
      try {
        const [pRaw, zonesRaw, thrRowsRaw] = await Promise.all([
          refreshCoachPrefsFromDB(userId),
          apiFetchUserZonesLatest(userId),
          apiFetchUserThresholdsLatest(userId),
        ]);
        if (!alive) return;

        console.log("[PREFS] pRaw from DB:", pRaw);

        // ⚠️ Dropni staré prefs.external_activities, nech to už v state ani v SAVE neexistuje
        const pAny = (pRaw || {}) as any;
        const { external_activities: _ext, ...p } = pAny;

        const zones = (zonesRaw ?? null) as any;
        const thrRows = (thrRowsRaw ?? []) as any[];

        const draftThr =
          Array.isArray(thrRows) && thrRows.length > 0
            ? { ...thrRows[0] }
            : undefined;

        const next: CoachPrefsExtended = {
          ...p,
          zones,
          thresholds: draftThr ?? undefined,
          thresholds_latest: thrRows,
        };

        console.log("[PREFS] next state before setLocal:", next);

        if (!dirtyRef.current) setLocal(next);
      } catch (e) {
        console.error("[CoachPrefs]init error", e);
      }
    })();

    return () => {
      alive = false;
    };
  }, [userId]);

  // start_date guard – min zajtra, default D+2
  useEffect(() => {
    setLocal((prev) => {
      const current = { ...prev };
      if (!current.start_date) {
        current.start_date = DEFAULT_PLAN_START();
      } else {
        const min = MIN_PLAN_START();
        if (current.start_date < min) current.start_date = min;
      }
      return current;
    });
  }, []);

  const prefDefaults = (p: CoachPrefsExtended) =>
    p.preferences ?? {
      days_off: [],
      long_run_days: [],
      avoid_back_to_back_hard: true,
      use_zones: true,
      avoid_two_a_day: false,
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
    const next: CoachPrefsExtended = { ...local, preferences: p };
    if (path.endsWith("days_off"))
      next.preferences!.days_off = v as DayAbbrev[];
    if (path.endsWith("long_run_days"))
      next.preferences!.long_run_days = v as DayAbbrev[];
    setLocal(next);
  };

  const upsertRunTargets = (patch: Partial<RunTargets>) => {
    markDirty();
    setLocal((prev) => {
      const prevTargets = prev.targets ?? {};

      const baseRun: RunTargets = {
        races: [],
        race_goal: null,
        custom_distance_km: null,
        current_best_time: null,
        target_time: null,
        longest_recent_distance_km: null,
        priority: null,
        race_type: null,
        terrain: null,
        elevation_profile: null,
      };

      const prevRun: RunTargets =
        (prevTargets.run as RunTargets | undefined) ?? baseRun;

      const nextRun: RunTargets = {
        ...baseRun,
        ...prevRun,
        ...patch,
      };

      return {
        ...prev,
        targets: {
          ...prevTargets,
          run: nextRun,
        },
      };
    });
  };

  // SAVE / REFRESH
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

      const minIso = MIN_PLAN_START();
      const startIso = (local.start_date ?? "").trim();

      // runtime-only polia von z payloadu
      const {
        zones: _z,
        thresholds: _t,
        thresholds_latest: _tl,
        ...rest
      } = local;

      const normalized: CoachPrefsExtended = {
        ...rest,
        start_date: !startIso || startIso < minIso ? minIso : startIso,
        primary_sports: primaries.length ? primaries : undefined,
        secondary_mix: (local.secondary_mix ?? [])
          .filter((x) => x.role !== "none" && Number(x.share_pct) > 0)
          .map((x) => ({ ...x, share_pct: Number(x.share_pct) || 0 })),
      };

      // vyčisti targets – ulož iba zmysluplné (vrátane swim)
      if (normalized.targets) {
        const t = normalized.targets as any;
        const cleaned: any = {};

        // run necháme vždy (aj keď je prázdny)
        if (t.run) cleaned.run = t.run;

        // ride len ak má čas/focus
        if (
          t.ride &&
          (t.ride.weekly_time_target_min != null ||
            (t.ride.focus && t.ride.focus !== "endurance"))
        ) {
          cleaned.ride = t.ride;
        }

        // strength len ak nie je default
        if (
          t.strength &&
          (t.strength.sessions_per_week != null ||
            (t.strength.focus && t.strength.focus !== "general"))
        ) {
          cleaned.strength = t.strength;
        }

        // NEW: swim – len ak má reálny cieľ
        if (
          t.swim &&
          (t.swim.weekly_time_target_min != null ||
            (t.swim.sessions_per_week != null &&
              Number(t.swim.sessions_per_week) > 0) ||
            (t.swim.focus && t.swim.focus !== "technique"))
        ) {
          cleaned.swim = {
            ...t.swim,
            sessions_per_week:
              t.swim.sessions_per_week != null
                ? Number(t.swim.sessions_per_week)
                : null,
          };
        }

        normalized.targets =
          Object.keys(cleaned).length > 0 ? cleaned : undefined;
      }

      // ⚠️ definitívne dropni staré prefs.external_activities z payloadu na BE
      const { external_activities: _ext2, ...normalizedClean } =
        normalized as any;

      await saveCoachPrefs(userId, normalizedClean);
      toast.success("Preferences saved");
      dirtyRef.current = false;
    } catch (e: any) {
      toast.error(String(e?.message ?? e));
    }
  };

  const onRefresh = async () => {
    if (!userId) return;
    try {
      const [fresh, zonesRaw, thrRowsRaw] = await Promise.all([
        refreshCoachPrefsFromDB(userId),
        apiFetchUserZonesLatest(userId),
        apiFetchUserThresholdsLatest(userId),
      ]);

      // opäť dropni eventual external_activities zo servera
      const pAny = (fresh || {}) as any;
      const { external_activities: _ext, ...p } = pAny;

      const zones = (zonesRaw ?? null) as any;
      const thrRows = (thrRowsRaw ?? []) as any[];

      const draftThr =
        Array.isArray(thrRows) && thrRows.length > 0
          ? { ...thrRows[0] }
          : undefined;

      const next: CoachPrefsExtended = {
        ...p,
        zones,
        thresholds: draftThr ?? undefined,
        thresholds_latest: thrRows,
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

  /* -------- Zones / Thresholds handlers -------- */
  const handleZonesChange = (z: any) => {
    setLocal((prev) => ({ ...prev, zones: z }));
    markDirty();
  };
  const handleSaveZonesToDB = async (z: any) => {
    if (!userId) return;
    try {
      const saved = await apiSaveUserZones(userId, z ?? {});
      setLocal((prev) => ({ ...prev, zones: saved ?? z }));
      toast.success("Zones saved to DB");
    } catch (e) {
      console.error(e);
      toast.error("Saving zones failed");
    }
  };

  const handleThresholdsChange = (t: any) => {
    setLocal((prev) => ({ ...prev, thresholds: t }));
    markDirty();
  };
  const handleSaveThresholdsToDB = async (t: any) => {
    if (!userId) return;
    try {
      const saved = await apiSaveUserThresholds(userId, t ?? {});
      setLocal((prev) => {
        const latest = Array.isArray(prev.thresholds_latest)
          ? prev.thresholds_latest
          : [];
        const keySaved = `${(
          saved?.sport ??
          t.sport ??
          "running"
        ).toLowerCase()}|${(
          saved?.threshold_type ??
          t.threshold_type ??
          "LT2"
        ).toLowerCase()}`;

        const filtered = latest.filter((r: any) => {
          const k = `${(r.sport ?? "").toLowerCase()}|${(
            r.threshold_type ?? ""
          ).toLowerCase()}`;
          return k !== keySaved;
        });

        const mergedRow = { ...(t ?? {}), ...(saved ?? {}) };

        return {
          ...prev,
          thresholds: mergedRow,
          thresholds_latest: [mergedRow, ...filtered],
        };
      });

      toast.success("Threshold saved to DB");
    } catch (e) {
      console.error(e);
      toast.error("Saving threshold failed");
    }
  };

  // LTHR pre výpočet zón – draft > DB
  const lthrBpm: number | null = useMemo(() => {
    const draft = Number(local?.thresholds?.hr_bpm);
    if (Number.isFinite(draft) && draft > 0) return draft;
    const rows = (local.thresholds_latest ?? []) as any[];
    const lt2 = rows.find(
      (r) => String(r.threshold_type).toUpperCase() === "LT2"
    );
    return lt2?.hr_bpm ?? null;
  }, [local?.thresholds?.hr_bpm, local.thresholds_latest]);

  return (
    <div className={["space-y-4", NO_X].join(" ")}>
      <PlanStartSection
        local={local}
        setLocal={setLocal}
        markDirty={markDirty}
      />

      <GoalSection
        local={local}
        setPref={setPref}
        upsertRunTargets={upsertRunTargets}
      />

      <SportsSection
        local={local}
        mainSport={mainSport}
        secondary={secondary}
        shareWarn={shareWarn}
        setPref={setPref}
        updateSecondary={updateSecondary}
      />

      <VolumeSection volume={local.volume} setPref={setPref} />

      <StrengthSection
        local={local}
        setLocal={setLocal}
        markDirty={markDirty}
      />

      <DaysOffSection
        daysOff={pref.days_off}
        toggleInArray={toggleInArray}
        setPrefNested={setPrefNested}
      />

      <LongRunDaysSection
        longRunDays={pref.long_run_days}
        toggleInArray={toggleInArray}
        setPrefNested={setPrefNested}
      />

      <RulesSection
        pref={pref}
        prefDefaults={prefDefaults}
        setLocal={setLocal}
        markDirty={markDirty}
      />

      <ZonesSection
        zones={local.zones}
        lthrBpm={lthrBpm}
        onZonesChange={handleZonesChange}
        onSaveZonesToDB={handleSaveZonesToDB}
      />

      <ThresholdsSection
        thresholds={local.thresholds}
        latestList={local.thresholds_latest ?? []}
        onChange={handleThresholdsChange}
        onSaveToDB={handleSaveThresholdsToDB}
      />

      <CoachPersonalitySection
        local={local}
        setPref={setPref}
        markDirty={markDirty}
      />

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
          <IntensityModelsSection
            local={local}
            setLocal={setLocal}
            setPref={setPref}
          />
          <InjuriesSection local={local} setLocal={setLocal} />
          <FocusAvoidSection
            local={local}
            setPref={setPref}
            toggleInArray={toggleInArray}
          />
          <RehabSection local={local} setPref={setPref} />
        </>
      )}

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
