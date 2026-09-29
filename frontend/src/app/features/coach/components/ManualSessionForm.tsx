// src/app/features/coach/components/ManualSessionForm.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { useT } from "@/app/shared/i18n/useT";
import Button from "@/app/shared/ui/components/Button";
import TextField from "@/app/shared/ui/components/TextField";
import SelectFieldFilter from "@/app/shared/ui/components/SelectFieldFilter";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { toast } from "@/app/shared/ui/components/Toast";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { STRENGTH_CATALOG_FE } from "@/app/shared/constants/strengthCatalog";
import {
  apiCreateManualSession,
  apiUpdateManualSession,
  type ManualDailySessionCreatePayload,
  type ManualStrengthExercisePayload,
  type ManualRunSessionType,
} from "@/app/features/coach/api/advisor_daily";
import type { DailyPlanSession } from "@/app/features/coach/api/coach_plan_daily";

type SportOption = "run" | "ride" | "swim" | "strength" | "other";
type StructureMode = "simple" | "intervals";

const SPORT_OPTIONS: { value: SportOption; labelKey: string }[] = [
  { value: "run", labelKey: "common.sports.run" },
  { value: "ride", labelKey: "common.sports.ride" },
  { value: "swim", labelKey: "common.sports.swim" },
  { value: "strength", labelKey: "common.sports.strength" },
  { value: "other", labelKey: "common.sports.other" },
];

const SESSION_TYPES: ManualRunSessionType[] = ["easy", "recovery", "long", "tempo", "interval"];

type StrengthDraftExercise = ManualStrengthExercisePayload & { _key: string };

let keyCounter = 0;
function nextKey() {
  keyCounter += 1;
  return `ex_${keyCounter}`;
}

function numStr(v: unknown): string {
  return v == null || v === "" ? "" : String(v);
}

function toNum(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

type ParsedInitial = {
  structureMode: StructureMode;
  warmupMin: string;
  warmupNotes: string;
  cooldownMin: string;
  cooldownNotes: string;
  mainMinutes: string;
  mainNotes: string;
  rounds: string;
  workMin: string;
  workNotes: string;
  restMin: string;
  restNotes: string;
  exercises: StrengthDraftExercise[];
};

/**
 * Predvyplnenie formulára z existujúcej session. Vždy vracia kompletný
 * objekt s defaultmi - žiadne union typy, žiadne undefined vetvy.
 */
function parseInitial(session: DailyPlanSession | null | undefined): ParsedInitial {
  const base: ParsedInitial = {
    structureMode: "simple",
    warmupMin: "",
    warmupNotes: "",
    cooldownMin: "",
    cooldownNotes: "",
    mainMinutes: "",
    mainNotes: "",
    rounds: "",
    workMin: "",
    workNotes: "",
    restMin: "",
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
          sets: Number(ex.sets) || 1,
          reps: String(ex.reps ?? ""),
        });
      }
    }
    return { ...base, exercises: exs };
  }

  const mainPart = Array.isArray(structure.main_part) ? structure.main_part[0] : null;
  const isIntervals = mainPart?.kind === "interval_block";

  return {
    ...base,
    structureMode: isIntervals ? "intervals" : "simple",
    warmupMin: numStr(structure.warmup?.minutes),
    warmupNotes: structure.warmup?.notes ?? "",
    cooldownMin: numStr(structure.cooldown?.minutes),
    cooldownNotes: structure.cooldown?.notes ?? "",
    mainMinutes: !isIntervals ? numStr(mainPart?.minutes) : "",
    mainNotes: !isIntervals ? mainPart?.notes ?? "" : "",
    rounds: isIntervals ? numStr(mainPart?.rounds) : "",
    workMin: isIntervals ? numStr(mainPart?.work?.minutes) : "",
    workNotes: isIntervals ? mainPart?.work?.notes ?? "" : "",
    restMin: isIntervals ? numStr(mainPart?.rest?.minutes) : "",
    restNotes: isIntervals ? mainPart?.rest?.notes ?? "" : "",
  };
}

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

  const initialSport: SportOption = SPORT_OPTIONS.some((o) => o.value === initialSession?.sport)
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
  const [durationMin, setDurationMin] = useState<string>(numStr(initialSession?.duration_min));
  const [notes, setNotes] = useState(initialSession?.notes || "");

  // run/ride/swim
  const [sessionType, setSessionType] = useState<ManualRunSessionType>(initialSessionType);
  const [sessionTypeTouched, setSessionTypeTouched] = useState(isEdit);
  const [structureMode, setStructureMode] = useState<StructureMode>(init.structureMode);
  const [warmupMin, setWarmupMin] = useState(init.warmupMin);
  const [warmupNotes, setWarmupNotes] = useState(init.warmupNotes);
  const [cooldownMin, setCooldownMin] = useState(init.cooldownMin);
  const [cooldownNotes, setCooldownNotes] = useState(init.cooldownNotes);
  const [mainMinutes, setMainMinutes] = useState(init.mainMinutes);
  const [mainNotes, setMainNotes] = useState(init.mainNotes);
  const [rounds, setRounds] = useState(init.rounds);
  const [workMin, setWorkMin] = useState(init.workMin);
  const [workNotes, setWorkNotes] = useState(init.workNotes);
  const [restMin, setRestMin] = useState(init.restMin);
  const [restNotes, setRestNotes] = useState(init.restNotes);

  // strength
  const [exercises, setExercises] = useState<StrengthDraftExercise[]>(init.exercises);
  const [pendingExerciseId, setPendingExerciseId] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

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
        target.scrollIntoView({ block: "center", behavior: "smooth" });
      }, 300);
    };
    container.addEventListener("focusin", onFocusIn);
    return () => container.removeEventListener("focusin", onFocusIn);
  }, []);

  const catalogOptions = useMemo(
    () =>
      Object.entries(STRENGTH_CATALOG_FE)
        .map(([id, names]) => ({ value: id, label: (names as any)[lang] as string }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [lang],
  );

  const isRunLike = sport === "run" || sport === "ride" || sport === "swim";
  const isStrength = sport === "strength";
  const isOther = sport === "other";

  // 🌟 NOVÉ: dĺžka pre run/ride/swim sa počíta z častí tréningu
  const computedDuration = useMemo(() => {
    if (!isRunLike) return 0;
    const wu = toNum(warmupMin);
    const cd = toNum(cooldownMin);
    if (structureMode === "simple") {
      return wu + toNum(mainMinutes) + cd;
    }
    const r = toNum(rounds);
    const work = toNum(workMin);
    const rest = toNum(restMin);
    return wu + r * work + Math.max(r - 1, 0) * rest + cd;
  }, [isRunLike, structureMode, warmupMin, cooldownMin, mainMinutes, rounds, workMin, restMin]);

  const changeStructureMode = (mode: StructureMode) => {
    setStructureMode(mode);
    // kým user typ ručne nezmenil, drž ho v súlade s režimom
    if (!sessionTypeTouched) {
      setSessionType(mode === "intervals" ? "interval" : "easy");
    }
  };

  const addExercise = (exerciseId: string) => {
    if (!exerciseId) return;
    setExercises((prev) => [
      ...prev,
      { _key: nextKey(), exercise_id: exerciseId, sets: 3, reps: "8-12" },
    ]);
    setPendingExerciseId("");
  };

  const removeExercise = (key: string) => {
    setExercises((prev) => prev.filter((e) => e._key !== key));
  };

  const updateExercise = (key: string, patch: Partial<StrengthDraftExercise>) => {
    setExercises((prev) => prev.map((e) => (e._key === key ? { ...e, ...patch } : e)));
  };

  const validate = (): string | null => {
    if (!title.trim()) return t("advisorDaily.form.errorTitle");

    if (isRunLike) {
      if (structureMode === "simple" && !toNum(mainMinutes)) {
        return t("advisorDaily.form.errorMain");
      }
      if (structureMode === "intervals" && (!toNum(rounds) || !toNum(workMin))) {
        return t("advisorDaily.form.errorIntervals");
      }
      if (computedDuration <= 0 || computedDuration > 600) {
        return t("advisorDaily.form.errorDuration");
      }
      return null;
    }

    const dur = Number(durationMin);
    if (!Number.isFinite(dur) || dur <= 0 || dur > 600) {
      return t("advisorDaily.form.errorDuration");
    }

    if (isStrength) {
      if (exercises.length === 0) return t("advisorDaily.form.errorExercises");
      for (const ex of exercises) {
        if (!ex.exercise_id || !ex.sets || !ex.reps.trim()) {
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
      duration_min: isRunLike ? Math.round(computedDuration) : Math.round(Number(durationMin)),
      notes: notes.trim() || null,
      plan_meta_id: planMetaId ?? null,
    };

    if (isRunLike) {
      payload.session_type = sessionType;
      payload.structure_mode = structureMode;
      if (toNum(warmupMin)) {
        payload.warmup_min = toNum(warmupMin);
        payload.warmup_notes = warmupNotes.trim() || null;
      }
      if (toNum(cooldownMin)) {
        payload.cooldown_min = toNum(cooldownMin);
        payload.cooldown_notes = cooldownNotes.trim() || null;
      }
      if (structureMode === "simple") {
        payload.main_minutes = toNum(mainMinutes);
        payload.main_notes = mainNotes.trim() || null;
      } else {
        payload.rounds = toNum(rounds);
        payload.work_min = toNum(workMin);
        payload.work_notes = workNotes.trim() || null;
        payload.rest_min = toNum(restMin);
        payload.rest_notes = restNotes.trim() || null;
      }
    }

    if (isStrength) {
      payload.exercises = exercises.map((e) => ({
        exercise_id: e.exercise_id,
        sets: e.sets,
        reps: e.reps.trim(),
      }));
    }

    setSubmitting(true);
    try {
      if (isEdit && initialSession?.id) {
        // plan_date sa pri úprave nemení - na to je reschedule
        const { plan_date: _pd, plan_meta_id: _pm, ...updatePayload } = payload;
        await apiUpdateManualSession(Number(userId), Number(initialSession.id), updatePayload);
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
            {isEdit ? t("advisorDaily.form.editTitle") : t("advisorDaily.form.addTitle")}
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

        <div
          ref={scrollRef}
          className="flex flex-col gap-3 p-4 overflow-y-auto"
          style={{ WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }}
        >
          {/* Šport - v edit móde zamknutý (iný šport = iná štruktúra) */}
          <div>
            <div className="text-xs opacity-60 mb-1">{t("advisorDaily.form.sportLabel")}</div>
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

          {/* Dĺžka - pre run/ride/swim automaticky, inak ručne */}
          {isRunLike ? (
            <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 flex items-center justify-between gap-2">
              <div className="text-xs opacity-60">{t("advisorDaily.form.durationLabel")}</div>
              <div className="text-sm font-semibold">
                {computedDuration > 0 ? `${computedDuration} ${t("common.units.min")}` : "—"}
              </div>
            </div>
          ) : (
            <TextField
              label={t("advisorDaily.form.durationLabel")}
              type="number"
              inputMode="numeric"
              min={1}
              value={durationMin}
              onChange={(e) => setDurationMin(e.target.value)}
            />
          )}

          {/* --- RUN / RIDE / SWIM --- */}
          {isRunLike && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-3 flex flex-col gap-3">
              <div>
                <div className="text-xs opacity-60 mb-1">{t("advisorDaily.form.sessionTypeLabel")}</div>
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
                  active={structureMode === "simple"}
                  onClick={() => changeStructureMode("simple")}
                  className="flex-1"
                >
                  {t("advisorDaily.form.simple")}
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant="prefs"
                  active={structureMode === "intervals"}
                  onClick={() => changeStructureMode("intervals")}
                  className="flex-1"
                >
                  {t("advisorDaily.form.intervals")}
                </Button>
              </div>

              {structureMode === "simple" ? (
                <>
                  <TextField
                    label={t("advisorDaily.form.mainMinutes")}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={mainMinutes}
                    onChange={(e) => setMainMinutes(e.target.value)}
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
                  <div className="grid grid-cols-2 gap-3">
                    <TextField
                      label={t("advisorDaily.form.rounds")}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={rounds}
                      onChange={(e) => setRounds(e.target.value)}
                    />
                    <TextField
                      label={t("advisorDaily.form.workMin")}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={workMin}
                      onChange={(e) => setWorkMin(e.target.value)}
                    />
                  </div>
                  <TextField
                    label={t("advisorDaily.form.workNotes")}
                    value={workNotes}
                    maxLength={300}
                    onChange={(e) => setWorkNotes(e.target.value)}
                  />
                  <TextField
                    label={t("advisorDaily.form.restMin")}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={restMin}
                    onChange={(e) => setRestMin(e.target.value)}
                  />
                  <TextField
                    label={t("advisorDaily.form.restNotes")}
                    value={restNotes}
                    maxLength={300}
                    onChange={(e) => setRestNotes(e.target.value)}
                  />
                </>
              )}

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/10">
                <TextField
                  label={t("advisorDaily.form.warmupMin")}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={warmupMin}
                  onChange={(e) => setWarmupMin(e.target.value)}
                />
                <TextField
                  label={t("advisorDaily.form.cooldownMin")}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={cooldownMin}
                  onChange={(e) => setCooldownMin(e.target.value)}
                />
              </div>
              <div className="text-[10px] opacity-50">{t("advisorDaily.form.durationAuto")}</div>
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
                      (STRENGTH_CATALOG_FE as any)[ex.exercise_id]?.[lang] || ex.exercise_id;
                    return (
                      <li
                        key={ex._key}
                        className="rounded-lg border border-white/10 bg-black/20 p-2 flex flex-col gap-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm font-medium truncate">{label}</div>
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
                          <TextField
                            label={t("advisorDaily.form.sets")}
                            type="number"
                            inputMode="numeric"
                            min={1}
                            value={String(ex.sets)}
                            onChange={(e) =>
                              updateExercise(ex._key, { sets: Number(e.target.value) || 1 })
                            }
                          />
                          <TextField
                            label={t("advisorDaily.form.reps")}
                            placeholder="8-12"
                            value={ex.reps}
                            onChange={(e) => updateExercise(ex._key, { reps: e.target.value })}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              <SelectFieldFilter
                value={pendingExerciseId}
                onValueChange={(id) => addExercise(id)}
                options={catalogOptions}
                placeholder={t("strengthLog.searchExercise")}
                searchPlaceholder={t("strengthLog.searchExercise")}
              />
            </div>
          )}

          {/* --- OTHER --- */}
          {isOther && (
            <div className="text-xs opacity-50">{t("advisorDaily.form.otherHint")}</div>
          )}

          <textarea
            className="w-full rounded bg-white/5 border border-white/10 p-2.5 text-sm text-white focus:border-white/30 focus:outline-none resize-none placeholder:text-white/20"
            rows={2}
            maxLength={1000}
            value={notes}
            placeholder={t("advisorDaily.form.notesPlaceholder")}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 justify-end px-4 py-3 border-t border-white/10 shrink-0">
          <Button size="sm" variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button size="sm" variant="primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? <LoadingSpinner size="button" /> : t("common.save")}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}