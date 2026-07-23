"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  CoachPrefs,
  SportKind,
  CoachPersona,
  RunTargets,
  SecondaryMix,
} from "@/app/features/prefs/types/prefs";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { useT } from "@/app/shared/i18n/useT";
import { toast } from "@/app/shared/ui/components/Toast";
import {
  refreshCoachPrefsFromDB,
  saveCoachPrefs,
} from "@/app/features/prefs/utils/prefs";

import Button from "@/app/shared/ui/components/Button";
import { NO_X } from "@/app/shared/ui/tokens";

import {
  apiFetchUserZonesLatest,
  apiSaveUserZones,
} from "@/app/features/performance/api/zones";
import {
  apiFetchUserThresholdsLatest,
  apiSaveUserThresholds,
} from "@/app/features/performance/api/thresholds";
import { apiGetStaticProfile } from "@/app/features/performance/api/static";

import { GoalSection } from "@/app/features/prefs/components/sections/GoalSection";
import { PlanStartSection } from "@/app/features/prefs/components/sections/PlanStartSection";
import { SportsSection } from "@/app/features/prefs/components/sections/SportsSection";
import { StrengthSection } from "@/app/features/prefs/components/sections/StrengthSection";
import { DaysSection } from "@/app/features/prefs/components/sections/DaysSection";
import { RulesSection } from "@/app/features/prefs/components/sections/RulesSection";
import ZonesSection from "@/app/features/prefs/components/sections/ZonesSection";
import ThresholdsSection from "@/app/features/prefs/components/sections/ThresholdsSection";
import { FocusAvoidSection } from "@/app/features/prefs/components/sections/FocusAvoidSection";
import { RehabSection } from "@/app/features/prefs/components/sections/RehabSection";
import { VolumeSection } from "@/app/features/prefs/components/sections/VolumeSection";
import PlanLifecycleSection from "@/app/features/prefs/components/sections/PlanLifecycleSection";

import {
  PANEL_STACK,
  PANEL_ACTIONS_INLINE,
} from "@/app/shared/ui/tokens/panels";

/* ---- local DTOs ---- */

type CoachPrefsExtended = CoachPrefs & {
  main_sport?: SportKind | null;
  secondary_mix?: SecondaryMix[];
  coach_voice?: CoachPersona | null;
  zones?: any;
  thresholds?: any;
  thresholds_latest?: any[] | null;
};

function isoTodayPlus(days: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const DEFAULT_PLAN_START = () => isoTodayPlus(2);
const MIN_PLAN_START = () => isoTodayPlus(1);

export default function CoachPreferencies() {
  const { userId } = useUserId();
  const t = useT();
  const dirtyRef = useRef(false);
  const markDirty = () => {
    dirtyRef.current = true;
  };

  const [local, setLocal] = useState<CoachPrefsExtended>(
    {} as CoachPrefsExtended,
  );

  const [isFemale, setIsFemale] = useState(false);

  const canGeneratePlan = useMemo(() => {
    const hasStartDate = !!(local.start_date && local.start_date.trim());
    const hasRace = Array.isArray(local.targets?.run?.races) && local.targets!.run!.races!.length > 0;
    return hasStartDate || hasRace;
  }, [local.start_date, local.targets]);

  useEffect(() => {
    if (!userId) return;
    let alive = true;

    (async () => {
      try {
        const [pRaw, zonesRaw, thrRowsRaw, staticProfile] = await Promise.all([
          refreshCoachPrefsFromDB(userId),
          apiFetchUserZonesLatest(userId),
          apiFetchUserThresholdsLatest(userId),
          apiGetStaticProfile(userId),
        ]);
        if (!alive) return;

        const pAny = (pRaw || {}) as any;
        const { external_activities: _ext, ...p } = pAny;
        const zones = (zonesRaw ?? null) as any;
        const thrRows = (thrRowsRaw ?? []) as any[];

        const sex = staticProfile?.sex?.toUpperCase() || "";
        setIsFemale(sex === "F");

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
      } catch (e: any) {
        console.error("[CoachPrefs]init error", t(e?.message as any));
      }
    })();

    return () => {
      alive = false;
    };
  }, [userId, t]);

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

  const prefDefaults = (p: CoachPrefsExtended): any => {
    const incoming = (p?.preferences ?? {}) as any;
    const two = incoming.two_a_day;
    const enabled = !!(two && typeof two === "object" ? two.enabled : false);
    const maxRaw =
      two && typeof two === "object" ? Number(two.max_days_per_week) : 0;
    const max = Number.isFinite(maxRaw) ? Math.max(0, Math.min(2, maxRaw)) : 0;
    const intensity_model =
      incoming.intensity_model === "pyramidal" ? "pyramidal" : "polarized";

    const b = incoming.training_blocks;
    const training_blocks =
      b && typeof b === "object"
        ? { vo2max: !!b.vo2max, ftp: !!b.ftp, threshold: !!b.threshold }
        : { vo2max: false, ftp: false, threshold: false };

    return {
      days_off: Array.isArray(incoming.days_off) ? incoming.days_off : [],
      long_run_days: Array.isArray(incoming.long_run_days)
        ? incoming.long_run_days
        : [],
      avoid_back_to_back_hard:
        typeof incoming.avoid_back_to_back_hard === "boolean"
          ? incoming.avoid_back_to_back_hard
          : true,
      two_a_day: { enabled, max_days_per_week: max },
      intensity_model,
      training_blocks,
      hr_zone_calc_mode: incoming.hr_zone_calc_mode ?? "manual",
      womens_health: incoming.womens_health,
    };
  };

  const toggleInArray = <T,>(arr: T[] | undefined, v: T): T[] =>
    (arr ?? []).includes(v)
      ? (arr ?? []).filter((x) => x !== v)
      : [...(arr ?? []), v];

  const setPref = <K extends keyof CoachPrefsExtended>(
    key: K,
    val: CoachPrefsExtended[K],
  ) => {
    markDirty();
    setLocal((prev) => ({ ...prev, [key]: val }));
  };

  const setPrefNested = (path: string, v: any) => {
    markDirty();
    setLocal((prev) => {
      const next: CoachPrefsExtended = { ...prev };

      const parts = path.split(".");
      if (parts[0] === "preferences") {
        const key = parts[1];
        next.preferences = {
          ...(next.preferences ?? {}),
          [key]: v,
        } as any;
      }

      return next;
    });
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
      const nextRun: RunTargets = { ...baseRun, ...prevRun, ...patch };
      return { ...prev, targets: { ...prevTargets, run: nextRun } };
    });
  };

  const onSave = async () => {
    if (!userId) return;
    try {
      const minIso = MIN_PLAN_START();
      const startIso = (local.start_date ?? "").trim();
      const {
        zones: _z,
        thresholds: _t,
        thresholds_latest: _tl,
        ...rest
      } = local;

      const normalized: any = {
        ...rest,
        start_date: !startIso || startIso < minIso ? minIso : startIso,
        secondary_mix: (local.secondary_mix ?? [])
          .filter((x) => x.role !== "none" && Number(x.share_pct) > 0),
      };

      if (normalized.targets) {
        const trg = normalized.targets as any;
        const cleaned: any = {};
        if (trg.run) cleaned.run = trg.run;
        if (
          trg.ride &&
          (trg.ride.weekly_time_target_min != null ||
            (trg.ride.focus && trg.ride.focus !== "endurance"))
        )
          cleaned.ride = trg.ride;
        if (
          trg.strength &&
          (trg.strength.sessions_per_week != null ||
            (trg.strength.focus && trg.strength.focus !== "general"))
        )
          cleaned.strength = trg.strength;
        if (
          trg.swim &&
          (trg.swim.weekly_time_target_min != null ||
            (trg.swim.sessions_per_week != null &&
              Number(trg.swim.sessions_per_week) > 0) ||
            (trg.swim.focus && trg.swim.focus !== "technique"))
        ) {
          cleaned.swim = {
            ...trg.swim,
            sessions_per_week:
              trg.swim.sessions_per_week != null
                ? Number(trg.swim.sessions_per_week)
                : null,
          };
        }
        normalized.targets = Object.keys(cleaned).length ? cleaned : undefined;
      }

      const { external_activities: _ext2, ...normalizedClean } = normalized;
      await saveCoachPrefs(userId, normalizedClean);
      toast.success(t("prefs.info.saveSuccess"));
      dirtyRef.current = false;
    } catch (e: any) {
      toast.error(t(e?.message as any) || t("api.prefs.saveFailed"));
    }
  };

  const onRefresh = async () => {
    if (!userId) return;
    try {
      const [fresh, zonesRaw, thrRowsRaw, staticProfile] = await Promise.all([
        refreshCoachPrefsFromDB(userId),
        apiFetchUserZonesLatest(userId),
        apiFetchUserThresholdsLatest(userId),
        apiGetStaticProfile(userId),
      ]);
      const pAny = (fresh || {}) as any;
      const { external_activities: _ext, ...p } = pAny;
      const zones = (zonesRaw ?? null) as any;
      const thrRows = (thrRowsRaw ?? []) as any[];
      const draftThr =
        Array.isArray(thrRows) && thrRows.length > 0
          ? { ...thrRows[0] }
          : undefined;

      const sex = staticProfile?.sex?.toUpperCase() || "";
      setIsFemale(sex === "F");

      const next: CoachPrefsExtended = {
        ...p,
        zones,
        thresholds: draftThr ?? undefined,
        thresholds_latest: thrRows,
      };

      if (!dirtyRef.current) setLocal(next);
      toast.success(t("prefs.info.refreshSuccess"));
    } catch (e: any) {
      toast.error(t(e?.message as any) || t("api.common.fetchFailed"));
    }
  };

  const pref = prefDefaults(local);
  const [showAdv, setShowAdv] = useState(false);
  const mainSport: SportKind | "" = (local.main_sport ?? "") as any;
  const addOnSports: SportKind[] = useMemo(() => {
    const v = (local as any).add_on_sports;
    return Array.isArray(v) ? (v as SportKind[]) : [];
  }, [local]);

  const handleZonesChange = (z: any) => {
    setLocal((prev) => ({ ...prev, zones: z }));
    markDirty();
  };

  const handleSaveZonesToDB = async (z: any) => {
    if (!userId) return;
    try {
      const savedZones = await apiSaveUserZones(userId, z ?? {});
      const freshPrefsFromDB = await refreshCoachPrefsFromDB(userId);
      const currentModeInUI = local.preferences?.hr_zone_calc_mode ?? "manual";

      const normalizedPrefs = {
        ...freshPrefsFromDB,
        preferences: {
          ...prefDefaults(freshPrefsFromDB as any),
          hr_zone_calc_mode: currentModeInUI,
        },
      } as CoachPrefs;

      await saveCoachPrefs(userId, normalizedPrefs);

      setLocal((prev) => ({
        ...prev,
        zones: savedZones ?? z,
        preferences: normalizedPrefs.preferences,
      }));

      toast.success(t("prefs.info.zonesSaved"));
    } catch (e: any) {
      toast.error(t(e?.message as any) || t("api.prefs.zonesSaveFailed"));
    }
  };

  const handleThresholdsChange = (th: any) => {
    setLocal((prev) => ({ ...prev, thresholds: th }));
    markDirty();
  };

  const handleSaveThresholdsToDB = async (th: any) => {
    if (!userId) return;
    try {
      const saved = await apiSaveUserThresholds(userId, th ?? {});
      setLocal((prev) => {
        const latest = Array.isArray(prev.thresholds_latest)
          ? prev.thresholds_latest
          : [];
        const keySaved = `${(saved?.sport ?? th.sport ?? "running").toLowerCase()}|${(saved?.threshold_type ?? th.threshold_type ?? "LT2").toLowerCase()}`;
        const filtered = latest.filter(
          (r: any) =>
            `${(r.sport ?? "").toLowerCase()}|${(r.threshold_type ?? "").toLowerCase()}` !==
            keySaved,
        );
        const mergedRow = { ...(th ?? {}), ...(saved ?? {}) };
        return {
          ...prev,
          thresholds: mergedRow,
          thresholds_latest: [mergedRow, ...filtered],
        };
      });
      toast.success(t("prefs.info.thresholdSaved"));
    } catch (e: any) {
      toast.error(t(e?.message as any) || t("api.prefs.thresholdsSaveFailed"));
    }
  };

  const lthrBpm: number | null = useMemo(() => {
    const draft = Number(local?.thresholds?.hr_bpm);
    if (Number.isFinite(draft) && draft > 0) return draft;
    const rows = (local.thresholds_latest ?? []) as any[];
    const lt2 = rows.find(
      (r) => String(r.threshold_type).toUpperCase() === "LT2",
    );
    return lt2?.hr_bpm ?? null;
  }, [local?.thresholds?.hr_bpm, local.thresholds_latest]);

  return (
    <div className={[PANEL_STACK, NO_X].join(" ")}>
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
        addOnSports={addOnSports}
        setPref={setPref}
      />
      <VolumeSection volume={local.volume} setPref={setPref} />
      <StrengthSection
        local={local}
        setLocal={setLocal}
        markDirty={markDirty}
      />
      <DaysSection
        daysOff={pref.days_off}
        longRunDays={pref.long_run_days}
        womensHealth={pref.womens_health}
        isFemale={isFemale}
        toggleInArray={toggleInArray}
        setPrefNested={setPrefNested}
      />
      <RulesSection pref={pref} setLocal={setLocal} markDirty={markDirty} />
      <ZonesSection
        zones={local.zones}
        lthrBpm={lthrBpm}
        onZonesChange={handleZonesChange}
        onSaveZonesToDB={handleSaveZonesToDB}
        calcMode={pref.hr_zone_calc_mode ?? "manual"}
        onCalcModeChange={(m) =>
          setPrefNested("preferences.hr_zone_calc_mode" as any, m)
        }
      />
      <ThresholdsSection
        thresholds={local.thresholds}
        latestList={local.thresholds_latest ?? []}
        onChange={handleThresholdsChange}
        onSaveToDB={handleSaveThresholdsToDB}
      />

      <div className={[PANEL_ACTIONS_INLINE, "justify-center"].join(" ")}>
        <button
          type="button"
          onClick={() => setShowAdv((s) => !s)}
          aria-expanded={showAdv}
          className="text-sm underline opacity-80 hover:opacity-100"
        >
          {showAdv
            ? t("prefs.actions.hideAdvanced")
            : t("prefs.actions.showAdvanced")}
        </button>
      </div>

      {showAdv && (
        <>
          <FocusAvoidSection
            local={local}
            setPref={setPref}
            toggleInArray={toggleInArray}
          />
          <RehabSection local={local} setPref={setPref} />
        </>
      )}

      <div
        className={[PANEL_ACTIONS_INLINE, "pt-4 border-t"].join(" ")}
        style={{ borderColor: "rgba(255,255,255,0.1)" }}
      >
        <Button onClick={onSave} variant="primary" className="flex-1">
          {t("common.save")}
        </Button>
        <Button onClick={onRefresh} variant="secondary">
          {t("common.refresh")}
        </Button>
      </div>

      {/* <PlanLifecycleSection canGenerate={canGeneratePlan} /> */}
    </div>
  );
}