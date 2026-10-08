// src/app/features/coach/components/ManualSessionForm.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { useVisualViewport } from "@/app/shared/hooks/useVisualViewport";
import { useT } from "@/app/shared/i18n/useT";
import Button from "@/app/shared/ui/components/Button";
import TextField from "@/app/shared/ui/components/TextField";
import NumberField from "@/app/shared/ui/components/NumberField";
import TimeField from "@/app/shared/ui/components/TimeField";
import SelectFieldFilter from "@/app/shared/ui/components/SelectFieldFilter";
import { useSettings } from "@/app/shared/i18n/SettingsProvider";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { toast } from "@/app/shared/ui/components/Toast";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { STRENGTH_CATALOG_FE } from "@/app/features/strength/constants/strengthCatalog";
import {
  getExerciseMeta,
  type ExerciseMeasure,
} from "@/app/features/strength/constants/strengthMeta";
import {
  apiCreateManualSession,
  apiUpdateManualSession,
  ACTIVITY_LOADS,
  EVENT_KINDS,
  defaultCountsAsTraining,
  type ActivityLoad,
  type EventKind,
  type ManualDailySessionCreatePayload,
  type ManualRunSessionType,
  type IntervalUnit,
} from "@/app/features/coach/api/advisor_daily";
import type { DailyPlanSession } from "@/app/features/coach/api/coach_plan_daily";
import ExercisePicker from "@/app/features/strength/components/ExercisePicker";
import MuscleVolumeDeltaStrip from "@/app/features/strength/components/MuscleVolumeDeltaStrip";
import {
  BUILTIN_SESSION_TEMPLATES,
  type BuiltinSessionTemplate,
  type SessionTemplateData,
  type UserSessionTemplate,
} from "@/app/features/coach/constants/sessionTemplates";
import {
  apiDeleteUserTemplate,
  apiListUserTemplates,
  apiSaveUserTemplate,
} from "@/app/features/coach/api/sessionTemplates";
import { localeTag, normalizeLang } from "@/app/shared/i18n/locale";

type SportOption = "run" | "ride" | "swim" | "strength" | "other";
type StructureMode = "simple" | "intervals";
type NumVal = number | "";

const SPORT_OPTIONS: { value: SportOption; labelKey: string }[] = [
  { value: "run", labelKey: "common.sports.run" },
  { value: "ride", labelKey: "common.sports.ride" },
  { value: "swim", labelKey: "common.sports.swim" },
  { value: "strength", labelKey: "common.sports.strength" },
  // Nie "iný šport", ale iná aktivita / udalosť
  { value: "other", labelKey: "advisorDaily.form.otherActivity" },
];

const SESSION_TYPES: ManualRunSessionType[] = [
  "easy",
  "recovery",
  "long",
  "tempo",
  "interval",
];

/** Tréning max 10 h, udalosť (svadba, teambuilding) môže trvať celý deň. */
const MAX_TRAINING_MIN = 600;
const MAX_EVENT_MIN = 1440;

/** Odstup modalu od okraja viditeľnej časti obrazovky (p-3 = 12 px hore aj dole). */
const OVERLAY_PAD_PX = 24;

type StrengthDraftExercise = {
  _key: string;
  exercise_id: string;
  sets: NumVal;
  reps: string;
};

let keyCounter = 0;
function nextKey() {
  keyCounter += 1;
  return `ex_${keyCounter}`;
}

/* ---------- helpers ---------- */

function n(v: NumVal): number {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0;
}

function toNumVal(v: unknown): NumVal {
  if (v == null || v === "") return "";
  const num = Number(v);
  return Number.isFinite(num) && num > 0 ? num : "";
}

/**
 * Predvolený rozsah podľa toho, ako sa cvik meria. Plank sa meria
 * v sekundách, sled push v metroch - "8-12" tam nedáva zmysel.
 */
function defaultRepsForMeasure(measure: ExerciseMeasure): string {
  if (measure === "time") return "30-45";
  if (measure === "distance") return "20-30";
  return "8-12";
}

/** "MM:SS" (aj rozpísané, napr. "01:3") -> sekundy. Doplnenie zhodné s TimeField blur. */
function mmssToSeconds(v: string): number {
  if (!v) return 0;
  const [m = "", s = ""] = v.split(":");
  const mm = parseInt(m || "0", 10);
  const ss = parseInt((s || "").padEnd(2, "0") || "0", 10);
  const total = (Number.isNaN(mm) ? 0 : mm) * 60 + (Number.isNaN(ss) ? 0 : ss);
  return total > 0 ? total : 0;
}

/** sekundy -> "MM:SS" pre TimeField (max 59:59). */
function secondsToMmss(sec: number): string {
  if (!sec || sec <= 0) return "";
  const clamped = Math.min(sec, 59 * 60 + 59);
  const mm = Math.floor(clamped / 60);
  const ss = clamped % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

function partSeconds(part: any): number {
  if (!part) return 0;
  if (part.duration_s != null) return Number(part.duration_s) || 0;
  if (part.minutes != null) return Math.round(Number(part.minutes) * 60) || 0;
  return 0;
}

type ParsedInitial = {
  structureMode: StructureMode;
  warmupMin: NumVal;
  warmupNotes: string;
  cooldownMin: NumVal;
  cooldownNotes: string;
  mainMinutes: NumVal;
  mainNotes: string;
  rounds: NumVal;
  workUnit: IntervalUnit;
  workTime: string;
  workDistance: NumVal;
  workNotes: string;
  restUnit: IntervalUnit;
  restTime: string;
  restDistance: NumVal;
  restNotes: string;
  exercises: StrengthDraftExercise[];
  eventKind: EventKind;
  eventLoad: ActivityLoad;
  countsAsTraining: boolean;
};

function parseInitial(
  session: DailyPlanSession | null | undefined,
): ParsedInitial {
  const base: ParsedInitial = {
    structureMode: "simple",
    warmupMin: "",
    warmupNotes: "",
    cooldownMin: "",
    cooldownNotes: "",
    mainMinutes: "",
    mainNotes: "",
    rounds: "",
    workUnit: "time",
    workTime: "",
    workDistance: "",
    workNotes: "",
    restUnit: "time",
    restTime: "",
    restDistance: "",
    restNotes: "",
    exercises: [],
    eventKind: "other",
    eventLoad: "easy",
    countsAsTraining: false,
  };

  const structure: any = session?.structure ?? null;
  if (!structure) return base;

  // Iná aktivita / udalosť - vlastná štruktúra, žiadny main_part
  const ev = structure.event;
  if (ev && typeof ev === "object") {
    return {
      ...base,
      eventKind: (ev.kind as EventKind) || "other",
      eventLoad: (ev.load as ActivityLoad) || "easy",
      countsAsTraining: !!ev.counts_as_training,
    };
  }

  if (session?.sport === "strength") {
    const exs: StrengthDraftExercise[] = [];
    for (const block of ["activation", "strength_main_part", "add_ons"]) {
      const list = Array.isArray(structure[block]) ? structure[block] : [];
      for (const ex of list) {
        if (!ex?.exercise_id) continue;
        exs.push({
          _key: nextKey(),
          exercise_id: String(ex.exercise_id),
          sets: toNumVal(ex.sets),
          reps: String(ex.reps ?? ""),
        });
      }
    }
    return { ...base, exercises: exs };
  }

  const mainPart = Array.isArray(structure.main_part)
    ? structure.main_part[0]
    : null;
  const isIntervals = mainPart?.kind === "interval_block";
  const work = mainPart?.work ?? null;
  const rest = mainPart?.rest ?? null;

  const workIsDistance = work?.distance_m != null;
  const restIsDistance = rest?.distance_m != null;

  return {
    ...base,
    structureMode: isIntervals ? "intervals" : "simple",
    warmupMin: toNumVal(structure.warmup?.minutes),
    warmupNotes: structure.warmup?.notes ?? "",
    cooldownMin: toNumVal(structure.cooldown?.minutes),
    cooldownNotes: structure.cooldown?.notes ?? "",
    mainMinutes: !isIntervals ? toNumVal(mainPart?.minutes) : "",
    mainNotes: !isIntervals ? (mainPart?.notes ?? "") : "",
    rounds: isIntervals ? toNumVal(mainPart?.rounds) : "",
    workUnit: workIsDistance ? "distance" : "time",
    workTime:
      isIntervals && !workIsDistance ? secondsToMmss(partSeconds(work)) : "",
    workDistance: workIsDistance ? toNumVal(work.distance_m) : "",
    workNotes: isIntervals ? (work?.notes ?? "") : "",
    restUnit: restIsDistance ? "distance" : "time",
    restTime:
      isIntervals && !restIsDistance ? secondsToMmss(partSeconds(rest)) : "",
    restDistance: restIsDistance ? toNumVal(rest.distance_m) : "",
    restNotes: isIntervals ? (rest?.notes ?? "") : "",
  };
}

/* ---------- small UI helpers ---------- */

function UnitToggle({
  value,
  onChange,
  timeLabel,
  distanceLabel,
}: {
  value: IntervalUnit;
  onChange: (u: IntervalUnit) => void;
  timeLabel: string;
  distanceLabel: string;
}) {
  return (
    <div className="flex gap-2">
      <Button
        type="button"
        size="xs"
        variant="prefs"
        active={value === "time"}
        onClick={() => onChange("time")}
        className="flex-1"
      >
        {timeLabel}
      </Button>
      <Button
        type="button"
        size="xs"
        variant="prefs"
        active={value === "distance"}
        onClick={() => onChange("distance")}
        className="flex-1"
      >
        {distanceLabel}
      </Button>
    </div>
  );
}

/* ---------- main ---------- */

type Props = {
  planDate: string;
  planMetaId?: number | null;
  initialSession?: DailyPlanSession | null;
  /** Predvyplní šablónu ("b:easy_run" / "u:<uuid>") - napr. z odporúčania hodnotenia. */
  initialTemplate?: { templateId: string; durationMin?: number | null } | null;
  /** Ak je zadané, user si vyberie deň (formulár otvorený mimo denného plánu). */
  dateOptions?: string[] | null;
  onClose: () => void;
  onSaved: () => void;
};

export default function ManualSessionForm({
  planDate,
  planMetaId,
  initialSession,
  initialTemplate,
  dateOptions,
  onClose,
  onSaved,
}: Props) {
  const t = useT();
  const { userId } = useUserId();
  const viewport = useVisualViewport();
  // PREČO useSettings: t je obyčajná funkcia bez "locale" - predtým bol
  // jazyk vždy "sk" a anglický user videl názvy cvikov po slovensky.
  const { lang: appLang } = useSettings();
  const lang = normalizeLang(appLang) ?? "en";
  const isEdit = !!initialSession?.id;

  const init = useMemo(() => parseInitial(initialSession), [initialSession]);

  const initialSport: SportOption = SPORT_OPTIONS.some(
    (o) => o.value === initialSession?.sport,
  )
    ? (initialSession!.sport as SportOption)
    : "run";

  const initialSessionType: ManualRunSessionType = SESSION_TYPES.includes(
    initialSession?.session_type as ManualRunSessionType,
  )
    ? (initialSession!.session_type as ManualRunSessionType)
    : init.structureMode === "intervals"
      ? "interval"
      : "easy";

  const [sport, setSport] = useState<SportOption>(initialSport);
  const [title, setTitle] = useState(initialSession?.title || "");
  const [durationMin, setDurationMin] = useState<NumVal>(
    toNumVal(initialSession?.duration_min),
  );
  const [notes, setNotes] = useState(initialSession?.notes || "");

  // run/ride/swim
  const [sessionType, setSessionType] =
    useState<ManualRunSessionType>(initialSessionType);
  const [sessionTypeTouched, setSessionTypeTouched] = useState(isEdit);
  const [structureMode, setStructureMode] = useState<StructureMode>(
    init.structureMode,
  );
  const [warmupMin, setWarmupMin] = useState<NumVal>(init.warmupMin);
  const [cooldownMin, setCooldownMin] = useState<NumVal>(init.cooldownMin);
  const [mainMinutes, setMainMinutes] = useState<NumVal>(init.mainMinutes);
  const [mainNotes, setMainNotes] = useState(init.mainNotes);

  const [rounds, setRounds] = useState<NumVal>(init.rounds);
  const [workUnit, setWorkUnit] = useState<IntervalUnit>(init.workUnit);
  const [workTime, setWorkTime] = useState(init.workTime);
  const [workDistance, setWorkDistance] = useState<NumVal>(init.workDistance);
  const [workNotes, setWorkNotes] = useState(init.workNotes);
  const [restUnit, setRestUnit] = useState<IntervalUnit>(init.restUnit);
  const [restTime, setRestTime] = useState(init.restTime);
  const [restDistance, setRestDistance] = useState<NumVal>(init.restDistance);
  const [restNotes, setRestNotes] = useState(init.restNotes);

  // strength
  const [exercises, setExercises] = useState<StrengthDraftExercise[]>(
    init.exercises,
  );
  const [pendingExerciseId, setPendingExerciseId] = useState("");

  // iná aktivita / udalosť
  const [eventKind, setEventKind] = useState<EventKind>(init.eventKind);
  const [eventLoad, setEventLoad] = useState<ActivityLoad>(init.eventLoad);
  const [countsAsTraining, setCountsAsTraining] = useState(
    init.countsAsTraining,
  );
  const [countsTouched, setCountsTouched] = useState(isEdit);

  const [submitting, setSubmitting] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Pri zmene druhu sa prepne aj "ráta sa do objemu" - kým to user
  // neprestaví ručne. Futbal áno, svadba nie.
  const changeEventKind = (k: EventKind) => {
    setEventKind(k);
    if (!countsTouched) setCountsAsTraining(defaultCountsAsTraining(k));
  };

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  /**
   * Pole, do ktorého sa práve píše, posunie do stredu viditeľnej časti
   * formulára. Funguje až vďaka tomu, že modal sa zmenší nad klávesnicu
   * (viď viewport nižšie) - predtým bol spodok formulára pod klávesnicou
   * a nebolo kam scrollovať.
   */
  const scrollActiveIntoView = useCallback(() => {
    const container = scrollRef.current;
    const active = document.activeElement as HTMLElement | null;
    if (!container || !active || !container.contains(active)) return;
    active.scrollIntoView({ block: "center", behavior: "smooth" });
  }, []);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const onFocusIn = () => window.setTimeout(scrollActiveIntoView, 50);
    container.addEventListener("focusin", onFocusIn);
    return () => container.removeEventListener("focusin", onFocusIn);
  }, [scrollActiveIntoView]);

  // Klávesnica sa vysúva postupne - po každej zmene viditeľnej výšky
  // dorovnáme pole znova, inak by skončilo pri jej hornom okraji.
  useEffect(() => {
    scrollActiveIntoView();
  }, [viewport?.height, scrollActiveIntoView]);

  const isRunLike = sport === "run" || sport === "ride" || sport === "swim";
  const isStrength = sport === "strength";
  const isOther = sport === "other";
  const isIntervals = structureMode === "intervals";
  const maxDuration = isOther ? MAX_EVENT_MIN : MAX_TRAINING_MIN;

  // Dĺžka sa dá spočítať len keď je všetko na čas
  const durationIsAuto =
    isRunLike && (!isIntervals || (workUnit === "time" && restUnit === "time"));

  const autoDuration = useMemo(() => {
    if (!isRunLike) return 0;
    const wu = n(warmupMin);
    const cd = n(cooldownMin);
    if (!isIntervals) return wu + n(mainMinutes) + cd;
    const r = n(rounds);
    const workS = mmssToSeconds(workTime);
    const restS = mmssToSeconds(restTime);
    const totalS = r * workS + Math.max(r - 1, 0) * restS;
    return Math.round(wu + totalS / 60 + cd);
  }, [
    isRunLike,
    isIntervals,
    warmupMin,
    cooldownMin,
    mainMinutes,
    rounds,
    workTime,
    restTime,
  ]);

  const changeStructureMode = (mode: StructureMode) => {
    setStructureMode(mode);
    if (!sessionTypeTouched) {
      setSessionType(mode === "intervals" ? "interval" : "easy");
    }
  };

  const addExercise = (exerciseId: string) => {
    if (!exerciseId) return;
    const measure = getExerciseMeta(exerciseId).measure;
    setExercises((prev) => [
      ...prev,
      {
        _key: nextKey(),
        exercise_id: exerciseId,
        sets: 3,
        reps: defaultRepsForMeasure(measure),
      },
    ]);
    setPendingExerciseId("");
  };

  const removeExercise = (key: string) => {
    setExercises((prev) => prev.filter((e) => e._key !== key));
  };

  const updateExercise = (
    key: string,
    patch: Partial<StrengthDraftExercise>,
  ) => {
    setExercises((prev) =>
      prev.map((e) => (e._key === key ? { ...e, ...patch } : e)),
    );
  };

  const finalDuration = durationIsAuto ? autoDuration : n(durationMin);

  /* ---------- šablóny ---------- */

  const [userTemplates, setUserTemplates] = useState<UserSessionTemplate[]>([]);
  const [templateValue, setTemplateValue] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [deleteArmed, setDeleteArmed] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    apiListUserTemplates(Number(userId)).then((list) => {
      if (alive) setUserTemplates(list);
    });
    return () => {
      alive = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!deleteArmed) return;
    const id = window.setTimeout(() => setDeleteArmed(false), 4000);
    return () => window.clearTimeout(id);
  }, [deleteArmed]);

  /** Vstavaná šablóna s preloženými textmi v jazyku usera. */
  const resolveBuiltin = (b: BuiltinSessionTemplate): SessionTemplateData => {
    const base = `advisorDaily.templates.items.${b.id}`;
    const data: SessionTemplateData = {
      ...b.data,
      title: t(`${base}.title` as any),
    };
    for (const key of b.texts) {
      data[key] = t(`${base}.${key}` as any);
    }
    return data;
  };

  /** Šablóna vyplní formulár, akoby ho user vyklikal - ďalej ho môže upraviť. */
  const applyTemplate = (d: SessionTemplateData) => {
    const toNum = (v: number | null | undefined): NumVal => toNumVal(v);
    setSport(d.sport);
    setTitle(d.title || "");
    setNotes(d.notes || "");
    setDurationMin(toNum(d.durationMin));

    setSessionType(d.sessionType ?? "easy");
    setSessionTypeTouched(true);
    setStructureMode(d.structureMode ?? "simple");
    setWarmupMin(toNum(d.warmupMin));
    setCooldownMin(toNum(d.cooldownMin));
    setMainMinutes(toNum(d.mainMinutes));
    setMainNotes(d.mainNotes || "");
    setRounds(toNum(d.rounds));
    setWorkUnit(d.workUnit ?? "time");
    setWorkTime(d.workTime || "");
    setWorkDistance(toNum(d.workDistance));
    setWorkNotes(d.workNotes || "");
    setRestUnit(d.restUnit ?? "time");
    setRestTime(d.restTime || "");
    setRestDistance(toNum(d.restDistance));
    setRestNotes(d.restNotes || "");

    setExercises(
      (d.exercises ?? []).map((e) => ({
        _key: nextKey(),
        exercise_id: e.exercise_id,
        sets: toNum(e.sets),
        reps: String(e.reps ?? ""),
      })),
    );

    setEventKind(d.eventKind ?? "other");
    setEventLoad(d.eventLoad ?? "easy");
    setCountsAsTraining(!!d.countsAsTraining);
    setCountsTouched(true);
  };

  /** Aktuálny stav formulára ako šablóna (ukladajú sa len polia daného športu). */
  const snapshot = (): SessionTemplateData => {
    const d: SessionTemplateData = {
      v: 1,
      sport,
      title: title.trim(),
      notes: notes.trim() || undefined,
    };
    if (isRunLike) {
      Object.assign(d, {
        sessionType,
        structureMode,
        warmupMin: n(warmupMin) || null,
        cooldownMin: n(cooldownMin) || null,
      });
      if (!isIntervals) {
        Object.assign(d, { mainMinutes: n(mainMinutes) || null, mainNotes: mainNotes.trim() || undefined });
      } else {
        Object.assign(d, {
          rounds: n(rounds) || null,
          workUnit,
          workTime: workUnit === "time" ? workTime : undefined,
          workDistance: workUnit === "distance" ? n(workDistance) || null : null,
          workNotes: workNotes.trim() || undefined,
          restUnit,
          restTime: restUnit === "time" ? restTime : undefined,
          restDistance: restUnit === "distance" ? n(restDistance) || null : null,
          restNotes: restNotes.trim() || undefined,
        });
      }
      if (!durationIsAuto) d.durationMin = n(durationMin) || null;
    } else {
      d.durationMin = n(durationMin) || null;
    }
    if (isStrength) {
      d.exercises = exercises.map((e) => ({
        exercise_id: e.exercise_id,
        sets: n(e.sets),
        reps: e.reps.trim(),
      }));
    }
    if (isOther) {
      Object.assign(d, { eventKind, eventLoad, countsAsTraining });
    }
    return d;
  };

  const sportLabel = (s: string) =>
    t((SPORT_OPTIONS.find((o) => o.value === s)?.labelKey ?? "common.sports.run") as any);

  const templateOptions = useMemo(
    () => [
      ...userTemplates.map((u) => ({
        value: `u:${u.id}`,
        label: `⭐ ${u.name} · ${sportLabel(u.data.sport)}`,
      })),
      ...BUILTIN_SESSION_TEMPLATES.map((b) => ({
        value: `b:${b.id}`,
        label: `${sportLabel(b.data.sport)} · ${t(`advisorDaily.templates.items.${b.id}.title` as any)}`,
      })),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userTemplates, t],
  );

  const selectedUserTemplate = templateValue.startsWith("u:")
    ? userTemplates.find((u) => `u:${u.id}` === templateValue) ?? null
    : null;

  /** Dĺžku z odporúčania dá do hlavnej časti (beh) alebo celkovej dĺžky (silový). */
  const withDuration = (d: SessionTemplateData, minutes?: number | null): SessionTemplateData => {
    if (!minutes || minutes <= 0) return d;
    if (d.sport === "strength" || d.sport === "other") return { ...d, durationMin: minutes };
    if ((d.structureMode ?? "simple") !== "simple") return d; // intervaly majú vlastnú štruktúru
    const main = minutes - (d.warmupMin ?? 0) - (d.cooldownMin ?? 0);
    return main > 0 ? { ...d, mainMinutes: main } : d;
  };

  /** true = šablóna sa našla a použila */
  const onTemplateChange = (value: string, minutes?: number | null): boolean => {
    setTemplateValue(value);
    setDeleteArmed(false);
    if (value.startsWith("b:")) {
      const b = BUILTIN_SESSION_TEMPLATES.find((x) => `b:${x.id}` === value);
      if (b) {
        applyTemplate(withDuration(resolveBuiltin(b), minutes));
        return true;
      }
    } else if (value.startsWith("u:")) {
      const u = userTemplates.find((x) => `u:${x.id}` === value);
      if (u) {
        applyTemplate(withDuration(u.data, minutes));
        return true;
      }
    }
    return false;
  };

  // Šablóna z odporúčania - vlastné šablóny sa načítavajú async, preto
  // sa skúša znova, kým nie sú v zozname. Použije sa len raz.
  const initialTemplateApplied = useRef(false);
  useEffect(() => {
    if (!initialTemplate?.templateId || initialTemplateApplied.current || isEdit) return;
    if (onTemplateChange(initialTemplate.templateId, initialTemplate.durationMin)) {
      initialTemplateApplied.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTemplate, userTemplates, isEdit]);

  const [chosenDate, setChosenDate] = useState(planDate);
  const dateSelectOptions = useMemo(
    () =>
      (dateOptions ?? []).map((d) => ({
        value: d,
        label: new Date(`${d}T12:00:00`).toLocaleDateString(localeTag(lang), {
          weekday: "short",
          day: "numeric",
          month: "numeric",
        }),
      })),
    [dateOptions, lang],
  );

  const handleSaveTemplate = async () => {
    if (!userId || savingTemplate) return;
    const name = templateName.trim();
    if (!name) {
      toast.error(t("advisorDaily.templates.nameRequired"));
      return;
    }
    // šablóna musí byť použiteľná - rovnaká kontrola ako pri uložení tréningu
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    setSavingTemplate(true);
    try {
      const next = await apiSaveUserTemplate(Number(userId), name, snapshot());
      setUserTemplates(next);
      setShowSaveTemplate(false);
      toast.success(t("advisorDaily.templates.saved"));
    } catch (e: any) {
      toast.error(t((e?.message || "advisorDaily.templates.saveError") as any));
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleDeleteTemplate = async () => {
    if (!userId || !selectedUserTemplate) return;
    if (!deleteArmed) {
      setDeleteArmed(true);
      return;
    }
    try {
      const next = await apiDeleteUserTemplate(Number(userId), selectedUserTemplate.id);
      setUserTemplates(next);
      setTemplateValue("");
      setDeleteArmed(false);
      toast.success(t("advisorDaily.templates.deleted"));
    } catch {
      toast.error(t("advisorDaily.templates.saveError"));
    }
  };

  const validate = (): string | null => {
    if (!title.trim()) return t("advisorDaily.form.errorTitle");

    if (isRunLike) {
      if (!isIntervals && !n(mainMinutes))
        return t("advisorDaily.form.errorMain");
      if (isIntervals) {
        const workOk =
          workUnit === "time"
            ? mmssToSeconds(workTime) > 0
            : n(workDistance) >= 50;
        if (!n(rounds) || !workOk) return t("advisorDaily.form.errorIntervals");
      }
    }

    if (finalDuration <= 0 || finalDuration > maxDuration)
      return t("advisorDaily.form.errorDuration");

    if (isStrength) {
      if (exercises.length === 0) return t("advisorDaily.form.errorExercises");
      for (const ex of exercises) {
        if (!ex.exercise_id || !n(ex.sets) || !ex.reps.trim()) {
          return t("advisorDaily.form.errorExerciseFields");
        }
      }
    }

    return null;
  };

  const handleSubmit = async () => {
    if (!userId || submitting) return;
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }

    const payload: ManualDailySessionCreatePayload = {
      plan_date: chosenDate,
      sport,
      title: title.trim(),
      duration_min: Math.round(finalDuration),
      notes: notes.trim() || null,
      plan_meta_id: planMetaId ?? null,
    };

    if (isRunLike) {
      payload.session_type = sessionType;
      payload.structure_mode = structureMode;
      if (n(warmupMin)) payload.warmup_min = n(warmupMin);
      if (n(cooldownMin)) payload.cooldown_min = n(cooldownMin);

      if (!isIntervals) {
        payload.main_minutes = n(mainMinutes);
        payload.main_notes = mainNotes.trim() || null;
      } else {
        payload.rounds = n(rounds);
        payload.work_unit = workUnit;
        if (workUnit === "time")
          payload.work_duration_s = mmssToSeconds(workTime);
        else payload.work_distance_m = n(workDistance);
        payload.work_notes = workNotes.trim() || null;

        payload.rest_unit = restUnit;
        if (restUnit === "time")
          payload.rest_duration_s = mmssToSeconds(restTime);
        else payload.rest_distance_m = n(restDistance);
        payload.rest_notes = restNotes.trim() || null;
      }
    }

    if (isStrength) {
      payload.exercises = exercises.map((e) => ({
        exercise_id: e.exercise_id,
        sets: n(e.sets),
        reps: e.reps.trim(),
      }));
    }

    if (isOther) {
      payload.event_kind = eventKind;
      payload.event_load = eventLoad;
      payload.counts_as_training = countsAsTraining;
    }

    setSubmitting(true);
    try {
      if (isEdit && initialSession?.id) {
        const { plan_date: _pd, plan_meta_id: _pm, ...updatePayload } = payload;
        await apiUpdateManualSession(
          Number(userId),
          Number(initialSession.id),
          updatePayload,
        );
      } else {
        await apiCreateManualSession(Number(userId), payload);
      }
      toast.success(t("common.done"));
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(t((e?.message || "advisorDaily.form.saveError") as any));
    } finally {
      setSubmitting(false);
    }
  };

  /*
   * Prekrytie sa drží VIDITEĽNEJ časti obrazovky, nie celého okna.
   * Na iOS klávesnica okno nezmenší, len ho prekryje - bez tohto by
   * spodok modalu (a pole, do ktorého píšeš) ostal pod klávesnicou.
   * Bez podpory visualViewport ostáva pôvodné správanie (inset-0, 85dvh).
   */
  const overlayStyle: React.CSSProperties = viewport
    ? {
        zIndex: 2147483000,
        top: viewport.offsetTop,
        height: viewport.height,
      }
    : { zIndex: 2147483000 };

  const modalMaxHeight = viewport
    ? viewport.keyboardOpen
      ? viewport.height - OVERLAY_PAD_PX
      : Math.min(viewport.height - OVERLAY_PAD_PX, viewport.height * 0.85)
    : undefined;

  return createPortal(
    <div
      className={[
        "fixed left-0 right-0 flex items-end sm:items-center justify-center bg-black/60 p-3",
        viewport ? "" : "inset-0",
      ].join(" ")}
      style={overlayStyle}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={[
          "w-full sm:max-w-lg rounded-2xl bg-[#0d1a12] border border-white/10 flex flex-col",
          viewport ? "" : "max-h-[85dvh]",
        ].join(" ")}
        style={{
          overscrollBehavior: "contain",
          maxHeight: modalMaxHeight,
        }}
      >
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-white/10 shrink-0">
          <div className="text-sm font-semibold">
            {isEdit
              ? t("advisorDaily.form.editTitle")
              : t("advisorDaily.form.addTitle")}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 shrink-0 rounded text-lg opacity-60 hover:opacity-100 transition-opacity"
            aria-label={t("common.cancel")}
          >
            ×
          </button>
        </div>

        {/* flex-1 + min-h-0, inak sa kontajner roztiahne na obsah a nescrolluje */}
        <div
          ref={scrollRef}
          className="flex-1 min-h-0 flex flex-col gap-3 p-4 pb-6 overflow-y-auto"
          style={{
            WebkitOverflowScrolling: "touch",
            overscrollBehavior: "contain",
          }}
        >
          {!isEdit && dateSelectOptions.length > 0 && (
            <SelectFieldFilter
              label={t("advisorDaily.form.dateLabel")}
              searchPlaceholder={t("advisorDaily.form.dateLabel")}
              emptyLabel="—"
              value={chosenDate}
              onValueChange={setChosenDate}
              options={dateSelectOptions}
            />
          )}

          {!isEdit && (
            <div className="flex flex-col gap-2">
              {/* SelectFieldFilter - jeho menu je nad modalom (zIndex), má aj vyhľadávanie */}
              <SelectFieldFilter
                label={t("advisorDaily.templates.label")}
                searchPlaceholder={t("advisorDaily.templates.search")}
                emptyLabel={t("advisorDaily.templates.empty")}
                placeholder={t("advisorDaily.templates.placeholder")}
                value={templateValue}
                onValueChange={onTemplateChange}
                options={templateOptions}
              />
              {selectedUserTemplate && (
                <div className="flex justify-end">
                  <Button size="xs" variant="danger" onClick={handleDeleteTemplate}>
                    {deleteArmed
                      ? t("advisorDaily.templates.deleteConfirm")
                      : t("advisorDaily.templates.delete")}
                  </Button>
                </div>
              )}
            </div>
          )}

          <div>
            <div className="text-xs opacity-60 mb-1">
              {t("advisorDaily.form.sportLabel")}
            </div>
            <div className="flex flex-wrap gap-2">
              {SPORT_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  type="button"
                  size="xs"
                  variant="prefs"
                  active={sport === opt.value}
                  disabled={isEdit}
                  onClick={() => setSport(opt.value)}
                >
                  {t(opt.labelKey as any)}
                </Button>
              ))}
            </div>
          </div>

          <TextField
            label={t("advisorDaily.form.titleLabel")}
            value={title}
            maxLength={200}
            placeholder={t("advisorDaily.form.titlePlaceholder")}
            onChange={(e) => setTitle(e.target.value)}
          />

          {durationIsAuto ? (
            <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 flex items-center justify-between gap-2">
              <div className="text-xs opacity-60">
                {t("advisorDaily.form.durationLabel")}
              </div>
              <div className="text-sm font-semibold">
                {autoDuration > 0
                  ? `${autoDuration} ${t("common.units.min")}`
                  : "—"}
              </div>
            </div>
          ) : (
            <NumberField
              label={t("advisorDaily.form.durationLabel")}
              hint={
                isRunLike
                  ? t("advisorDaily.form.durationManualHint")
                  : undefined
              }
              unit={t("common.units.min")}
              min={1}
              max={maxDuration}
              value={durationMin}
              onChange={setDurationMin}
            />
          )}

          {/* --- RUN / RIDE / SWIM --- */}
          {isRunLike && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-3 flex flex-col gap-3">
              <div>
                <div className="text-xs opacity-60 mb-1">
                  {t("advisorDaily.form.sessionTypeLabel")}
                </div>
                <div className="flex flex-wrap gap-2">
                  {SESSION_TYPES.map((st) => (
                    <Button
                      key={st}
                      type="button"
                      size="xs"
                      variant="prefs"
                      active={sessionType === st}
                      onClick={() => {
                        setSessionType(st);
                        setSessionTypeTouched(true);
                      }}
                    >
                      {t(`advisorDaily.form.sessionTypes.${st}` as any)}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  size="xs"
                  variant="prefs"
                  active={!isIntervals}
                  onClick={() => changeStructureMode("simple")}
                  className="flex-1"
                >
                  {t("advisorDaily.form.simple")}
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant="prefs"
                  active={isIntervals}
                  onClick={() => changeStructureMode("intervals")}
                  className="flex-1"
                >
                  {t("advisorDaily.form.intervals")}
                </Button>
              </div>

              {!isIntervals ? (
                <>
                  <NumberField
                    label={t("advisorDaily.form.mainMinutes")}
                    unit={t("common.units.min")}
                    min={1}
                    max={600}
                    value={mainMinutes}
                    onChange={setMainMinutes}
                  />
                  <TextField
                    label={t("advisorDaily.form.mainNotes")}
                    value={mainNotes}
                    maxLength={300}
                    onChange={(e) => setMainNotes(e.target.value)}
                  />
                </>
              ) : (
                <>
                  <NumberField
                    label={t("advisorDaily.form.rounds")}
                    min={1}
                    max={50}
                    value={rounds}
                    onChange={setRounds}
                  />

                  {/* Úsek */}
                  <div className="rounded-lg border border-white/10 bg-black/20 p-2.5 flex flex-col gap-2">
                    <div className="text-xs font-semibold opacity-80">
                      {t("advisorDaily.form.workLabel")}
                    </div>
                    <UnitToggle
                      value={workUnit}
                      onChange={setWorkUnit}
                      timeLabel={t("advisorDaily.form.unitTime")}
                      distanceLabel={t("advisorDaily.form.unitDistance")}
                    />
                    {workUnit === "time" ? (
                      <TimeField
                        label={t("advisorDaily.form.timeMmss")}
                        hh={false}
                        mm
                        ss
                        value={workTime}
                        onChange={setWorkTime}
                      />
                    ) : (
                      <NumberField
                        label={t("advisorDaily.form.distanceM")}
                        unit="m"
                        min={50}
                        max={50000}
                        value={workDistance}
                        onChange={setWorkDistance}
                      />
                    )}
                    <TextField
                      label={t("advisorDaily.form.workNotes")}
                      value={workNotes}
                      maxLength={300}
                      onChange={(e) => setWorkNotes(e.target.value)}
                    />
                  </div>

                  {/* Pauza */}
                  <div className="rounded-lg border border-white/10 bg-black/20 p-2.5 flex flex-col gap-2">
                    <div className="text-xs font-semibold opacity-80">
                      {t("advisorDaily.form.restLabel")}
                    </div>
                    <UnitToggle
                      value={restUnit}
                      onChange={setRestUnit}
                      timeLabel={t("advisorDaily.form.unitTime")}
                      distanceLabel={t("advisorDaily.form.unitDistance")}
                    />
                    {restUnit === "time" ? (
                      <TimeField
                        label={t("advisorDaily.form.timeMmss")}
                        hh={false}
                        mm
                        ss
                        value={restTime}
                        onChange={setRestTime}
                      />
                    ) : (
                      <NumberField
                        label={t("advisorDaily.form.distanceM")}
                        unit="m"
                        min={0}
                        max={10000}
                        value={restDistance}
                        onChange={setRestDistance}
                      />
                    )}
                    <TextField
                      label={t("advisorDaily.form.restNotes")}
                      value={restNotes}
                      maxLength={300}
                      onChange={(e) => setRestNotes(e.target.value)}
                    />
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/10">
                <NumberField
                  label={t("advisorDaily.form.warmupMin")}
                  unit={t("common.units.min")}
                  min={0}
                  max={120}
                  value={warmupMin}
                  onChange={setWarmupMin}
                />
                <NumberField
                  label={t("advisorDaily.form.cooldownMin")}
                  unit={t("common.units.min")}
                  min={0}
                  max={120}
                  value={cooldownMin}
                  onChange={setCooldownMin}
                />
              </div>
              {durationIsAuto && (
                <div className="text-[10px] opacity-50">
                  {t("advisorDaily.form.durationAuto")}
                </div>
              )}
            </div>
          )}

          {/* --- STRENGTH --- */}
          {isStrength && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-3 flex flex-col gap-3">
              <div className="text-xs font-semibold opacity-80">
                {t("advisorDaily.form.exercisesLabel")}
              </div>

              {exercises.length > 0 && (
                <ul className="flex flex-col gap-2">
                  {exercises.map((ex) => {
                    const label =
                      (STRENGTH_CATALOG_FE as any)[ex.exercise_id]?.[lang] ||
                      ex.exercise_id;

                    // Jednotka podľa cviku. Plank sa meria v sekundách,
                    // sled push v metroch - pýtať pri nich "opakovania"
                    // bolo mätúce.
                    const measure = getExerciseMeta(ex.exercise_id).measure;
                    const repsLabel =
                      measure === "time"
                        ? t("advisorDaily.form.seconds")
                        : measure === "distance"
                          ? t("advisorDaily.form.meters")
                          : t("advisorDaily.form.reps");

                    return (
                      <li
                        key={ex._key}
                        className="rounded-lg border border-white/10 bg-black/20 p-2 flex flex-col gap-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm font-medium truncate">
                            {label}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeExercise(ex._key)}
                            className="shrink-0 w-6 h-6 rounded text-sm opacity-30 hover:opacity-100 transition-opacity"
                            style={{ color: appColors.statusError }}
                            title={t("common.delete")}
                          >
                            ×
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <NumberField
                            label={t("advisorDaily.form.sets")}
                            min={1}
                            max={20}
                            showReset={false}
                            value={ex.sets}
                            onChange={(v) =>
                              updateExercise(ex._key, { sets: v })
                            }
                          />
                          <TextField
                            label={repsLabel}
                            placeholder={defaultRepsForMeasure(measure)}
                            maxLength={20}
                            value={ex.reps}
                            onChange={(e) =>
                              updateExercise(ex._key, { reps: e.target.value })
                            }
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              <ExercisePicker
                value={pendingExerciseId}
                onValueChange={(id) => addExercise(id)}
                placeholder={t("strengthLog.searchExercise")}
              />
              <MuscleVolumeDeltaStrip
                draft={exercises.map((e) => ({
                  exercise_id: e.exercise_id,
                  sets: n(e.sets),
                }))}
              />
            </div>
          )}

          {/* --- INÁ AKTIVITA / UDALOSŤ --- */}
          {isOther && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-3 flex flex-col gap-3">
              <div>
                <div className="text-xs opacity-60 mb-1">
                  {t("advisorDaily.form.eventKindLabel")}
                </div>
                <div className="flex flex-wrap gap-2">
                  {EVENT_KINDS.map((k) => (
                    <Button
                      key={k}
                      type="button"
                      size="xs"
                      variant="prefs"
                      active={eventKind === k}
                      onClick={() => changeEventKind(k)}
                    >
                      {t(`advisorDaily.form.eventKinds.${k}` as any)}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs opacity-60 mb-1">
                  {t("advisorDaily.form.eventLoadLabel")}
                </div>
                <div className="flex gap-2">
                  {ACTIVITY_LOADS.map((l) => (
                    <Button
                      key={l}
                      type="button"
                      size="xs"
                      variant="prefs"
                      active={eventLoad === l}
                      onClick={() => setEventLoad(l)}
                      className="flex-1"
                    >
                      {t(`advisorDaily.form.eventLoads.${l}` as any)}
                    </Button>
                  ))}
                </div>
                <div className="text-[11px] opacity-60 mt-1.5 leading-relaxed">
                  {t(`advisorDaily.form.eventLoadHints.${eventLoad}` as any)}
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={countsAsTraining}
                  onChange={() => {
                    setCountsAsTraining((c) => !c);
                    setCountsTouched(true);
                  }}
                  className="w-3.5 h-3.5 rounded border-white/20 bg-white/5 cursor-pointer"
                  style={{ accentColor: appColors.brandPrimary }}
                />
                <span>{t("advisorDaily.form.countsAsTraining")}</span>
              </label>
              <div className="text-[11px] opacity-50 leading-relaxed -mt-1.5">
                {t("advisorDaily.form.countsAsTrainingHint")}
              </div>
            </div>
          )}

          <textarea
            className="w-full rounded bg-white/5 border border-white/10 p-2.5 text-sm text-white focus:border-white/30 focus:outline-none resize-none placeholder:text-white/20 shrink-0"
            rows={2}
            maxLength={1000}
            value={notes}
            placeholder={t("advisorDaily.form.notesPlaceholder")}
            onChange={(e) => setNotes(e.target.value)}
          />

          {showSaveTemplate ? (
            <div className="rounded-xl border border-white/10 bg-white/5 p-3 flex flex-col gap-2">
              <TextField
                label={t("advisorDaily.templates.nameLabel")}
                value={templateName}
                maxLength={60}
                onChange={(e) => setTemplateName(e.target.value)}
              />
              <div className="text-[11px] opacity-50">
                {t("advisorDaily.templates.saveHint")}
              </div>
              <div className="flex justify-end gap-2">
                <Button size="xs" variant="secondary" onClick={() => setShowSaveTemplate(false)}>
                  {t("common.cancel")}
                </Button>
                <Button size="xs" variant="primary" onClick={handleSaveTemplate} disabled={savingTemplate}>
                  {savingTemplate ? <LoadingSpinner size="button" /> : t("advisorDaily.templates.saveBtn")}
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setTemplateName(title.trim());
                setShowSaveTemplate(true);
              }}
              className="self-start text-xs underline opacity-70 hover:opacity-100"
            >
              {t("advisorDaily.templates.saveAs")}
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 justify-end px-4 py-3 border-t border-white/10 shrink-0">
          <Button size="sm" variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? <LoadingSpinner size="button" /> : t("common.save")}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
