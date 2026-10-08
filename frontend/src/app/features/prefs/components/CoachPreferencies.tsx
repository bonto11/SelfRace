// src/app/features/prefs/components/CoachPreferencies.tsx
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  CoachPrefs,
  CoachMode,
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
import { InputsCardControlContext } from "@/app/shared/ui/components/InputsCard";
import {
  readSectionProgress,
  writeSectionProgress,
  sectionStatus,
  RESETTABLE_SECTIONS,
  type PrefsSectionKey,
} from "@/app/features/prefs/utils/sectionProgress";
import { NO_X } from "@/app/shared/ui/tokens";
import { appColors } from "@/app/shared/ui/theme/app_colors";

import {
  apiFetchUserZonesLatest,
  apiSaveUserZones,
} from "@/app/features/performance/api/zones";
import {
  apiFetchUserThresholdsLatest,
  apiSaveUserThresholds,
} from "@/app/features/performance/api/thresholds";
import { apiGetStaticProfile } from "@/app/features/performance/api/static";
import { apiActivePlanStatus } from "@/app/features/coach/api/coach_plan_active";

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
import { CoachModeSection } from "@/app/features/prefs/components/sections/CoachModeSection";
import AthleteTrainerSection from "@/app/features/trainer/components/AthleteTrainerSection";
import { useTrainerOverview } from "@/app/features/trainer/hooks/useTrainerOverview";

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
// Plán môže začať najskôr dnes.
const MIN_PLAN_START = () => isoTodayPlus(0);

/* ---- detailed mode toggle (malý switch, appColors) ---- */

function DetailedModeToggle({
  checked,
  onToggle,
}: {
  checked: boolean;
  onToggle: () => void;
}) {
  const t = useT();
  return (
    <div
      className={PANEL_ACTIONS_INLINE}
      style={{
        justifyContent: "space-between",
        alignItems: "center",
        padding: "14px 16px",
        borderRadius: 12,
        border: `1px solid ${appColors.surfaceCardBorder}`,
        background: appColors.surfaceCard,
        marginBottom: 4,
      }}
    >
      <div>
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: appColors.textPrimary,
          }}
        >
          {t("prefs.detailedMode.title")}
        </div>
        <div
          style={{
            fontSize: 12,
            opacity: 0.75,
            color: appColors.textSecondary,
          }}
        >
          {t("prefs.detailedMode.text")}
        </div>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onToggle}
        style={{
          width: 46,
          height: 26,
          borderRadius: 999,
          border: `1px solid ${appColors.surfaceCardBorder}`,
          background: checked ? appColors.buttonMainBg : appColors.surfaceSolid,
          position: "relative",
          cursor: "pointer",
          flexShrink: 0,
          transition: "background 0.2s ease",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: checked ? 22 : 2,
            width: 20,
            height: 20,
            borderRadius: "50%",
            background: checked
              ? appColors.buttonMainText
              : appColors.textMuted,
            transition: "left 0.2s ease",
          }}
        />
      </button>
    </div>
  );
}

/* ---- spodok otvorenej sekcie: Hotovo + Obnoviť predvolené ---- */

function SectionFooter({
  canReset,
  onReset,
  onDone,
}: {
  canReset: boolean;
  onReset: () => void;
  onDone: () => void;
}) {
  const t = useT();
  // Reset na dva kliky - pri cieli by jedným ťukom zmizli aj preteky.
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const id = window.setTimeout(() => setArmed(false), 4000);
    return () => window.clearTimeout(id);
  }, [armed]);

  return (
    <div
      className="flex items-center gap-2 pt-3 border-t"
      style={{ borderColor: appColors.surfaceCardBorder }}
    >
      {canReset ? (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => {
            if (!armed) {
              setArmed(true);
              return;
            }
            setArmed(false);
            onReset();
          }}
        >
          {armed ? t("prefs.accordion.resetConfirm") : t("prefs.accordion.reset")}
        </Button>
      ) : null}
      <Button
        type="button"
        size="sm"
        variant="primary"
        className="ml-auto"
        onClick={onDone}
      >
        {t("prefs.accordion.confirm")}
      </Button>
    </div>
  );
}

/* ---- postup nastavenia (x z y) ---- */

function SectionProgress({ done, total }: { done: number; total: number }) {
  const t = useT();
  if (total <= 0) return null;
  const pct = Math.round((done / total) * 100);
  return (
    <div style={{ padding: "4px 2px" }}>
      <div
        className="flex items-center justify-between"
        style={{ fontSize: 13, color: appColors.textSecondary, marginBottom: 6 }}
      >
        <span>{t("prefs.accordion.progressTitle")}</span>
        <span style={{ fontWeight: 700, color: appColors.textPrimary }}>
          {t("prefs.accordion.progress")
            .replace("{{done}}", String(done))
            .replace("{{total}}", String(total))}
        </span>
      </div>
      <div
        style={{
          height: 4,
          borderRadius: 999,
          background: appColors.surfaceCardBorder,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: appColors.brandPrimary,
            transition: "width 0.3s ease",
          }}
        />
      </div>
    </div>
  );
}

export default function CoachPreferencies() {
  const { userId } = useUserId();
  const t = useT();
  const dirtyRef = useRef(false);
  // Sekcia otvorená v akordeóne a sekcie, v ktorých user v tejto návšteve
  // niečo zmenil - zmena = vedome nastavené, aj keď ostane hodnota z defaultu.
  const openKeyRef = useRef<PrefsSectionKey | null>(null);
  const touchedRef = useRef<Set<PrefsSectionKey>>(new Set());
  const markDirty = () => {
    dirtyRef.current = true;
    if (openKeyRef.current) touchedRef.current.add(openKeyRef.current);
  };

  const [local, setLocal] = useState<CoachPrefsExtended>(
    {} as CoachPrefsExtended,
  );

  const [isFemale, setIsFemale] = useState(false);
  // Režim uložený v DB - po uložení sa aktualizuje, aby sa zámok
  // prepnutia späť na trénera zapol hneď, nie až po reloade.
  const [savedCoachMode, setSavedCoachMode] = useState<CoachMode>("coach");
  const [switchingMode, setSwitchingMode] = useState(false);

  // Živý tréner: aktívny link zamkne AI režimy, čakajúca žiadosť otvorí sekciu.
  const trainerState = useTrainerOverview();
  const [trainerOpen, setTrainerOpen] = useState(false);
  // počas prezerania zverenca je overview trénerovo – sekcia by ukazovala jeho kód
  const trainerAvailable = !!trainerState.overview?.enabled && !trainerState.trainerView;
  const trainerActive = trainerAvailable && !!trainerState.overview?.trainer;
  const showTrainerSection =
    trainerAvailable &&
    (trainerActive || trainerOpen || (trainerState.overview?.trainer_requests.length ?? 0) > 0);

  // 🌟 Stav aktivneho planu - riadi poradie sekcii (ked je plan aktivny,
  // PlanLifecycleSection ide hore a PlanStartSection je defaultne zabalena;
  // ked plan nie je, zobrazi sa banner + PlanStartSection otvorena hore).
  // null = este nezistene (pociatocny loading stav).
  const [hasActivePlan, setHasActivePlan] = useState<boolean | null>(null);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    apiActivePlanStatus(userId)
      .then((s) => {
        if (alive) setHasActivePlan(!!s?.has_active);
      })
      .catch(() => {
        if (alive) setHasActivePlan(false);
      });
    return () => {
      alive = false;
    };
  }, [userId]);

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
        setSavedCoachMode(((p as any).coach_mode as CoachMode) ?? "coach");

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
      detailed_mode:
        typeof incoming.detailed_mode === "boolean"
          ? incoming.detailed_mode
          : false,
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

  const savingRef = useRef(false);

  const onSave = async (opts?: { silent?: boolean }) => {
    if (!userId || savingRef.current) return;
    savingRef.current = true;
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
        secondary_mix: (local.secondary_mix ?? []).filter(
          (x) => x.role !== "none" && Number(x.share_pct) > 0,
        ),
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
      setSavedCoachMode((normalizedClean.coach_mode as CoachMode) ?? "coach");
      toast.success(
        opts?.silent ? t("prefs.accordion.autosaved") : t("prefs.info.saveSuccess"),
      );
      dirtyRef.current = false;
    } catch (e: any) {
      if (e?.message === "advisor_plan_active") {
        toast.error(t("prefs.coachMode.cannotSwitchBack" as any));
        return;
      }
      toast.error(t(e?.message as any) || t("api.prefs.saveFailed"));
    } finally {
      savingRef.current = false;
    }
  };

  // Najnovší onSave pre listener mimo renderu (zatvorenie / skrytie appky).
  const saveRef = useRef(onSave);
  saveRef.current = onSave;

  /* ---- akordeón sekcií + autosave ---- */

  const [openKey, setOpenKey] = useState<PrefsSectionKey | null>(null);
  const [confirmed, setConfirmed] = useState<PrefsSectionKey[]>([]);

  useEffect(() => {
    if (!userId) return;
    const stored = readSectionProgress(userId);
    setConfirmed(stored.confirmed);
    // user pokračuje tam, kde skončil
    if (stored.last) {
      openKeyRef.current = stored.last;
      setOpenKey(stored.last);
    }
  }, [userId]);

  const persistProgress = useCallback(
    (nextConfirmed: PrefsSectionKey[], last: PrefsSectionKey | null) => {
      writeSectionProgress(userId, { confirmed: nextConfirmed, last });
    },
    [userId],
  );

  const addConfirmed = (
    list: PrefsSectionKey[],
    key: PrefsSectionKey,
  ): PrefsSectionKey[] => (list.includes(key) ? list : [...list, key]);

  const handleSectionOpen = (
    key: PrefsSectionKey,
    open: boolean,
    opts?: { confirm?: boolean },
  ) => {
    const prev = openKey;
    let nextConfirmed = confirmed;
    // Opustenie sekcie: fajka len ak v nej user niečo zmenil alebo dal
    // Hotovo - samotné otvorenie a zatvorenie sekciu neoznačí.
    if (prev && (prev !== key || !open)) {
      if (opts?.confirm || touchedRef.current.has(prev)) {
        nextConfirmed = addConfirmed(nextConfirmed, prev);
      }
      touchedRef.current.delete(prev);
      if (dirtyRef.current) void onSave({ silent: true });
    }
    if (nextConfirmed !== confirmed) setConfirmed(nextConfirmed);
    const nextOpen = open ? key : null;
    openKeyRef.current = nextOpen;
    setOpenKey(nextOpen);
    persistProgress(nextConfirmed, nextOpen);
  };

  // Obnoví sekciu na predvolené hodnoty (= ako keby ju user nikdy nenastavil).
  // Uloží sa pri zatvorení sekcie ako každá iná zmena.
  const resetSection = (key: PrefsSectionKey) => {
    setLocal((prev) => {
      const next: any = { ...prev };
      const prefs: any = { ...(prev.preferences ?? {}) };
      switch (key) {
        case "planStart":
          next.start_date = DEFAULT_PLAN_START();
          next.end_date = null;
          next.weeks = null;
          break;
        case "goal":
          next.goal_kind = null;
          next.targets = { ...(prev.targets ?? {}), run: undefined };
          break;
        case "sports":
          next.main_sport = null;
          next.add_on_sports = [];
          next.secondary_mix = [];
          break;
        case "volume":
          next.volume = null;
          break;
        case "strength":
          next.strength_settings = undefined;
          break;
        case "days":
          prefs.days_off = [];
          prefs.long_run_days = [];
          next.preferences = prefs;
          break;
        case "rules":
          prefs.avoid_back_to_back_hard = true;
          prefs.two_a_day = { enabled: false, max_days_per_week: 0 };
          prefs.intensity_model = "polarized";
          prefs.training_blocks = { vo2max: false, ftp: false, threshold: false };
          next.preferences = prefs;
          break;
        case "focusAvoid":
          next.focus_areas = [];
          next.avoid_zones = [];
          break;
        case "rehab":
          next.rehab_focus = undefined;
          break;
      }
      return next;
    });
    dirtyRef.current = true;
    // reset nie je "nastavenie" - fajka zmizne
    touchedRef.current.delete(key);
    const nextConfirmed = confirmed.filter((k) => k !== key);
    setConfirmed(nextConfirmed);
    persistProgress(nextConfirmed, openKey);
  };

  // Zatvorenie appky / prepnutie do inej appky na telefóne - visibilitychange
  // je jediná udalosť, ktorá na iOS PWA spoľahlivo príde.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden" && dirtyRef.current) {
        void saveRef.current({ silent: true });
      }
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, []);

  const statusOf = (key: PrefsSectionKey) =>
    sectionStatus(key, local, confirmed);

  const statusLabels = {
    done: t("prefs.accordion.done"),
    default: t("prefs.accordion.defaultState"),
    todo: t("prefs.accordion.todo"),
  } as const;

  const slot = (key: PrefsSectionKey, node: ReactNode) => {
    const status = statusOf(key);
    return (
      <InputsCardControlContext.Provider
        key={key}
        value={{
          open: openKey === key,
          onOpenChange: (o) => handleSectionOpen(key, o),
          status,
          statusLabel: statusLabels[status],
          footer: (
            <SectionFooter
              canReset={RESETTABLE_SECTIONS.includes(key)}
              onReset={() => resetSection(key)}
              onDone={() => handleSectionOpen(key, false, { confirm: true })}
            />
          ),
        }}
      >
        {node}
      </InputsCardControlContext.Provider>
    );
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
      setSavedCoachMode(((p as any).coach_mode as CoachMode) ?? "coach");

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

  
  const isAdvisorMode = local.coach_mode === "advisor";
  // Prepnutie režimu sa ukladá hneď a samostatne - uloží sa LEN coach_mode
  // nad čerstvými prefs z DB. Ostatné rozpracované zmeny formulára ostávajú
  // neuložené (dirtyRef sa nemení).
  const handleCoachModeChange = async (next: CoachMode) => {
    if (!userId || switchingMode) return;
    setSwitchingMode(true);
    try {
      const fresh = ((await refreshCoachPrefsFromDB(userId)) || {}) as any;
      const { external_activities: _ext, ...base } = fresh;

      await saveCoachPrefs(userId, { ...base, coach_mode: next } as CoachPrefs);

      setSavedCoachMode(next);
      // setLocal, nie setPref - setPref by označil formulár ako zmenený
      setLocal((prev) => ({ ...prev, coach_mode: next }));
      toast.success(t("prefs.coachMode.switched" as any));
    } catch (e: any) {
      if (e?.message === "advisor_plan_active") {
        toast.error(t("prefs.coachMode.cannotSwitchBack" as any));
      } else {
        toast.error(t(e?.message as any) || t("api.prefs.saveFailed"));
      }
    } finally {
      setSwitchingMode(false);
    }
  };

  // BE pri prijatí trénera prepne coach_mode na advisor - zosúladiť formulár
  // (setLocal, nie setPref - nemá sa to rátať ako neuložená zmena).
  const handleTrainerAccepted = async () => {
    if (!userId) return;
    try {
      await refreshCoachPrefsFromDB(userId);
    } catch {
      /* stav sa dočíta pri ďalšom otvorení */
    }
    setSavedCoachMode("advisor");
    setLocal((prev) => ({ ...prev, coach_mode: "advisor" }));
    setTrainerOpen(false);
  };

  const showPlanStart = hasActivePlan !== null && !isAdvisorMode;
  const visibleKeys: PrefsSectionKey[] = [
    ...(showPlanStart ? (["planStart"] as PrefsSectionKey[]) : []),
    "goal",
    ...(pref.detailed_mode
      ? ([
          "sports",
          "volume",
          "strength",
          "days",
          "rules",
          "zones",
          "thresholds",
          ...(showAdv ? (["focusAvoid", "rehab"] as PrefsSectionKey[]) : []),
        ] as PrefsSectionKey[])
      : []),
  ];
  // predvolené (voliteľné) sekcie sú v poriadku - rátajú sa ako vybavené
  const doneCount = visibleKeys.filter((k) => statusOf(k) !== "todo").length;

  return (
    <div className={[PANEL_STACK, NO_X].join(" ")}>
      {hasActivePlan === true && <PlanLifecycleSection prefs={local} />}

      {hasActivePlan === false && (
        <div
          style={{
            padding: "14px 16px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.03)",
            marginBottom: 4,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
            {t("prefs.noActivePlanBanner.title")}
          </div>
          <div style={{ fontSize: 13, opacity: 0.75, lineHeight: 1.4 }}>
            {isAdvisorMode
              ? t("prefs.noActivePlanBanner.textAdvisor")
              : t("prefs.noActivePlanBanner.text")}
          </div>
        </div>
      )}

      {/* 🌟 ZMENA: najprv režim, potom začiatok plánu */}
      <CoachModeSection
        local={local}
        hasActivePlan={hasActivePlan === true}
        savedMode={savedCoachMode}
        onChange={handleCoachModeChange}
        busy={switchingMode}
        trainerAvailable={trainerAvailable}
        trainerActive={trainerActive}
        trainerOpen={trainerOpen}
        onTrainerOpenChange={setTrainerOpen}
      />

      {showTrainerSection && userId && (
        <AthleteTrainerSection
          userId={Number(userId)}
          overview={trainerState.overview}
          reload={trainerState.reload}
          onAccepted={handleTrainerAccepted}
        />
      )}



      {/* Začiatok/koniec pre AI plán - v advisor režime sa koniec volí
          priamo pri "Začať plán" (PlanLifecycleSection) */}
      <SectionProgress done={doneCount} total={visibleKeys.length} />

      {showPlanStart &&
        slot(
          "planStart",
          <PlanStartSection
            local={local}
            setLocal={setLocal}
            markDirty={markDirty}
            defaultOpen={!hasActivePlan}
          />,
        )}

      {slot(
        "goal",
        <GoalSection
          local={local}
          setPref={setPref}
          upsertRunTargets={upsertRunTargets}
        />,
      )}

      <DetailedModeToggle
        checked={!!pref.detailed_mode}
        onToggle={() =>
          setPrefNested("preferences.detailed_mode" as any, !pref.detailed_mode)
        }
      />

      {pref.detailed_mode && (
        <>
          {slot(
            "sports",
            <SportsSection
              local={local}
              mainSport={mainSport}
              addOnSports={addOnSports}
              setPref={setPref}
            />,
          )}
          {slot(
            "volume",
            <VolumeSection volume={local.volume} setPref={setPref} />,
          )}
          {slot(
            "strength",
            <StrengthSection
              local={local}
              setLocal={setLocal}
              markDirty={markDirty}
            />,
          )}
          {slot(
            "days",
            <DaysSection
              daysOff={pref.days_off}
              longRunDays={pref.long_run_days}
              womensHealth={pref.womens_health}
              isFemale={isFemale}
              toggleInArray={toggleInArray}
              setPrefNested={setPrefNested}
            />,
          )}
          {slot(
            "rules",
            <RulesSection pref={pref} setLocal={setLocal} markDirty={markDirty} />,
          )}
          {slot(
            "zones",
            <ZonesSection
              zones={local.zones}
              lthrBpm={lthrBpm}
              onZonesChange={handleZonesChange}
              onSaveZonesToDB={handleSaveZonesToDB}
              calcMode={pref.hr_zone_calc_mode ?? "manual"}
              onCalcModeChange={(m) =>
                setPrefNested("preferences.hr_zone_calc_mode" as any, m)
              }
            />,
          )}
          {slot(
            "thresholds",
            <ThresholdsSection
              thresholds={local.thresholds}
              latestList={local.thresholds_latest ?? []}
              onChange={handleThresholdsChange}
              onSaveToDB={handleSaveThresholdsToDB}
            />,
          )}

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
              {slot(
                "focusAvoid",
                <FocusAvoidSection
                  local={local}
                  setPref={setPref}
                  toggleInArray={toggleInArray}
                />,
              )}
              {slot("rehab", <RehabSection local={local} setPref={setPref} />)}
            </>
          )}
        </>
      )}

      <div
        className={[PANEL_ACTIONS_INLINE, "pt-4 border-t"].join(" ")}
        style={{ borderColor: "rgba(255,255,255,0.1)" }}
      >
        <Button onClick={() => onSave()} variant="primary" className="flex-1">
          {t("common.save")}
        </Button>
        <Button onClick={onRefresh} variant="secondary">
          {t("common.refresh")}
        </Button>
      </div>

      {hasActivePlan !== true && <PlanLifecycleSection prefs={local} />}
    </div>
  );

}
