// src/app/features/coach/components/ManualSessionForm.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { useT } from "@/app/shared/i18n/useT";
import Button from "@/app/shared/ui/components/Button";
import TextField from "@/app/shared/ui/components/TextField";
import NumberField from "@/app/shared/ui/components/NumberField";
import TimeField from "@/app/shared/ui/components/TimeField";
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
  type ManualDailySessionCreatePayload,
  type ManualRunSessionType,
  type IntervalUnit,
} from "@/app/features/coach/api/advisor_daily";
import type { DailyPlanSession } from "@/app/features/coach/api/coach_plan_daily";
import ExercisePicker from "@/app/features/strength/components/ExercisePicker";
import MuscleVolumeDeltaStrip from "@/app/features/strength/components/MuscleVolumeDeltaStrip";

type SportOption = "run" | "ride" | "swim" | "strength" | "other";
type StructureMode = "simple" | "intervals";
type NumVal = number | "";

const SPORT_OPTIONS: { value: SportOption; labelKey: string }[] = [
  { value: "run", labelKey: "common.sports.run" },
  { value: "ride", labelKey: "common.sports.ride" },
  { value: "swim", labelKey: "common.sports.swim" },
  { value: "strength", labelKey: "common.sports.strength" },
  { value: "other", labelKey: "common.sports.other" },
];

const SESSION_TYPES: ManualRunSessionType[] = [
  "easy",
  "recovery",
  "long",
  "tempo",
  "interval",
];

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
 * 🌟 NOVÉ: predvolený rozsah podľa toho, ako sa cvik meria. Plank sa meria
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
  };

  const structure: any = session?.structure ?? null;
  if (!structure) return base;

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
  onClose: () => void;
  onSaved: () => void;
};

export default function ManualSessionForm({
  planDate,
  planMetaId,
  initialSession,
  onClose,
  onSaved,
}: Props) {
  const t = useT();
  const { userId } = useUserId();
  const lang = (t as any)?.locale?.startsWith("en") ? "en" : "sk";
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

  const [submitting, setSubmitting] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const notesRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target || !container.contains(target)) return;
      window.setTimeout(() => {
        // Poznámka je posledný prvok formulára - "center" ju pri otvorenej
        // klávesnici nedokáže dostať nad ňu, lebo pod ňou už nie je obsah,
        // o ktorý by sa dalo odscrollovať. Preto pre ňu scrollujeme
        // kontajner úplne na koniec.
        if (target === notesRef.current) {
          container.scrollTo({
            top: container.scrollHeight,
            behavior: "smooth",
          });
          return;
        }
        target.scrollIntoView({ block: "center", behavior: "smooth" });
      }, 300);
    };
    container.addEventListener("focusin", onFocusIn);
    return () => container.removeEventListener("focusin", onFocusIn);
  }, []);

  const isRunLike = sport === "run" || sport === "ride" || sport === "swim";
  const isStrength = sport === "strength";
  const isOther = sport === "other";
  const isIntervals = structureMode === "intervals";

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

    if (finalDuration <= 0 || finalDuration > 600)
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
      plan_date: planDate,
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

  return createPortal(
    <div
      className="fixed inset-0 flex items-end sm:items-center justify-center bg-black/60 p-3"
      style={{ zIndex: 2147483000 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full sm:max-w-lg rounded-2xl bg-[#0d1a12] border border-white/10 flex flex-col max-h-[85dvh]"
        style={{ overscrollBehavior: "contain" }}
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
          className="flex-1 min-h-0 flex flex-col gap-3 p-4 overflow-y-auto"
          style={{
            WebkitOverflowScrolling: "touch",
            overscrollBehavior: "contain",
          }}
        >
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
              max={600}
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

                    // 🌟 NOVÉ: jednotka podľa cviku. Plank sa meria v
                    // sekundách, sled push v metroch - pýtať pri nich
                    // "opakovania" bolo mätúce.
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

          {isOther && (
            <div className="text-xs opacity-50">
              {t("advisorDaily.form.otherHint")}
            </div>
          )}

          <textarea
            ref={notesRef}
            className="w-full rounded bg-white/5 border border-white/10 p-2.5 text-sm text-white focus:border-white/30 focus:outline-none resize-none placeholder:text-white/20 shrink-0"
            rows={2}
            maxLength={1000}
            value={notes}
            placeholder={t("advisorDaily.form.notesPlaceholder")}
            onChange={(e) => setNotes(e.target.value)}
          />

          {/* Priestor pod poznámkou, aby ju mal kontajner kam odscrollovať
              nad klávesnicu. Bez neho je poznámka posledný prvok a scroll
              nemá kam ísť. */}
          <div className="h-32 shrink-0" aria-hidden="true" />
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
