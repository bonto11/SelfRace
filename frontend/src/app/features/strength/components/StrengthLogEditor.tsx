// src/app/features/strength/components/StrengthLogEditor.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { useT } from "@/app/shared/i18n/useT";
import { STRENGTH_CATALOG_FE } from "@/app/features/strength/constants/strengthCatalog";
import { getExerciseMeta } from "@/app/features/strength/constants/strengthMeta";
import { formatPrescription } from "@/app/features/strength/utils/strengthFormat";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import Button from "@/app/shared/ui/components/Button";
import DateField from "@/app/shared/ui/components/DateField";
import TextField from "@/app/shared/ui/components/TextField";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { TooltipIcon } from "@/app/shared/ui/components/Tooltip";
import { confirm } from "@/app/shared/ui/components/Confirm";
import { toast } from "@/app/shared/ui/components/Toast";
import ExerciseSuggestionModal from "@/app/features/strength/components/ExerciseSuggestionModal";
import {
  apiGetStrengthSession,
  apiUpdateStrengthSession,
  apiDeleteStrengthSession,
  apiListPlannedStrengthSessions,
  apiImportFromPlan,
  type StrengthExerciseLog,
  type StrengthSetEntry,
  type StrengthBlock,
  type PlannedStrengthSession,
} from "@/app/features/strength/api/strength_sessions";
import {
  PLAN_STRUCT_STACK,
  PLAN_BLOCK,
  PLAN_BLOCK_LABEL,
  PLAN_EX_LIST,
  SESSION_SUBCARD,
  SESSION_SUBCARD_STYLE,
  PANEL_PAD,
} from "@/app/shared/ui/tokens";
import ExercisePicker from "@/app/features/strength/components/ExercisePicker";
import MuscleVolumeDeltaStrip from "@/app/features/strength/components/MuscleVolumeDeltaStrip";
import {
  apiGetMuscleVolume,
  type MuscleVolumeOverview,
} from "@/app/features/strength/api/strength_sessions";
import InputsCard, {
  InputsCardControlContext,
} from "@/app/shared/ui/components/InputsCard";
import { appLang, appLocale } from "@/app/shared/i18n/locale";

const SAVE_DEBOUNCE_MS = 1200;

const BLOCK_ORDER: StrengthBlock[] = [
  "activation",
  "strength_main_part",
  "add_ons",
];

const BLOCK_LABEL_KEY: Record<StrengthBlock, string> = {
  activation: "sessions.detail.plan.activation",
  strength_main_part: "sessions.detail.plan.strengthMain",
  add_ons: "sessions.detail.plan.addOns",
};

type Props = {
  sessionId?: number;
  showAdvanced?: boolean;
  onDeleted?: () => void;
};

/** Vyplnené pracovné série - rovnako ráta BE (warmup a prázdne série nie). */
function loggedSetCount(ex: StrengthExerciseLog): number {
  return (ex.sets ?? []).filter((s) => !s.is_warmup && (s.reps || s.weight_kg)).length;
}

function formatPlanDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  const day = d.toLocaleDateString(appLocale(), {
    day: "2-digit",
    month: "2-digit",
  });
  const wd = d.toLocaleDateString(appLocale(), { weekday: "short" });
  return `${wd} · ${day}`;
}

function SetFieldTile({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl border flex-1 min-w-0 px-3 py-2"
      style={{
        background: appColors.backgroundAlt,
        borderColor: appColors.surfaceCardBorder,
      }}
    >
      <div className="text-[10px] uppercase tracking-wider font-bold opacity-50 mb-1">
        {label}
      </div>
      {children}
    </div>
  );
}

export default function StrengthLogEditor({ sessionId, onDeleted }: Props) {
  const t = useT();
  const { userId } = useUserId();
  const lang = appLang();

  const [loading, setLoading] = useState(true);
  const [exercises, setExercises] = useState<StrengthExerciseLog[]>([]);
  const [sessionDate, setSessionDate] = useState<string>("");
  const [title, setTitle] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [completed, setCompleted] = useState(false);

  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saveError, setSaveError] = useState(false);

  const [addPanelOpen, setAddPanelOpen] = useState(false);
  const [addBlock, setAddBlock] = useState<StrengthBlock>("strength_main_part");
  const [pendingExerciseId, setPendingExerciseId] = useState("");

  // 🌟 NOVÉ: modal na návrh chýbajúceho cviku do katalógu
  const [suggestOpen, setSuggestOpen] = useState(false);

  const [planPickerOpen, setPlanPickerOpen] = useState(false);
  const [plannedSessions, setPlannedSessions] = useState<
    PlannedStrengthSession[]
  >([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // akordeón ako v prefs: otvorený je vždy len jeden cvik
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  // PREČO jeden základ pre celý editor: každý cvik si ho predtým načítal sám
  // v inom čase, takže cviky na tú istú partiu ukazovali rôzny "zvyšok týždňa"
  const [volumeBase, setVolumeBase] = useState<MuscleVolumeOverview | null>(null);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ exercises, completed, note, sessionDate, title });
  latest.current = { exercises, completed, note, sessionDate, title };

  useEffect(() => {
    if (!userId || !sessionId) {
      setLoading(false);
      return;
    }
    let alive = true;
    (async () => {
      setLoading(true);
      const s = await apiGetStrengthSession(Number(userId), sessionId);
      if (!alive) return;
      if (s) {
        const exs = s.log?.exercises ?? [];
        setExercises(exs);
        // otvor prvý cvik, ktorý ešte nemá nič zapísané
        const firstTodo = exs.findIndex((e) => loggedSetCount(e) === 0);
        setOpenIdx(firstTodo >= 0 ? firstTodo : null);
        setSessionDate(s.session_date);
        setTitle(s.title ?? "");
        setNote(s.session_note ?? "");
        setCompleted(!!s.completed);
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [userId, sessionId]);

  useEffect(() => {
    if (!userId || !sessionId) return;
    let alive = true;
    apiGetMuscleVolume(Number(userId), 4, sessionId).then((res) => {
      if (alive) setVolumeBase(res);
    });
    return () => {
      alive = false;
    };
  }, [userId, sessionId]);

  const scheduleSave = useCallback(() => {
    if (!userId || !sessionId) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const snap = latest.current;
      setSaving(true);
      setSaveError(false);
      const res = await apiUpdateStrengthSession(Number(userId), sessionId, {
        exercises: snap.exercises,
        completed: snap.completed,
        session_note: snap.note || null,
        session_date: snap.sessionDate,
        title: snap.title || null,
      });
      setSaving(false);
      if (res) {
        setSavedAt(
          new Date().toLocaleTimeString(appLocale(), {
            hour: "2-digit",
            minute: "2-digit",
          }),
        );
      } else {
        setSaveError(true);
      }
    }, SAVE_DEBOUNCE_MS);
  }, [userId, sessionId]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const handleDeleteSession = useCallback(async () => {
    if (!userId || !sessionId || deleting) return;
    const ok = await confirm({
      title: t("strengthLog.deleteConfirmTitle"),
      message: t("strengthLog.deleteConfirmMessage"),
      okText: t("common.delete"),
      cancelText: t("common.cancel"),
      tone: "danger",
    });
    if (!ok) return;

    setDeleting(true);
    if (timer.current) clearTimeout(timer.current);

    const done = await apiDeleteStrengthSession(Number(userId), sessionId);
    setDeleting(false);

    if (done) {
      toast.success(t("common.deleted"));
      onDeleted?.();
    } else {
      toast.error(t("strengthLog.deleteError"));
    }
  }, [userId, sessionId, deleting, t, onDeleted]);

  const openPlanPicker = useCallback(async () => {
    if (!userId) return;
    setPlanPickerOpen(true);
    setPlansLoading(true);
    const rows = await apiListPlannedStrengthSessions(userId, {
      days_back: 14,
      days_forward: 7,
    });
    setPlannedSessions(rows);
    setPlansLoading(false);
  }, [userId]);

  const handleImport = useCallback(
    async (planSessionId: number) => {
      if (!userId || !sessionId || importing) return;

      const hasLoggedSets = exercises.some((ex) => (ex.sets ?? []).length > 0);
      if (hasLoggedSets) {
        const ok = await confirm({
          title: t("strengthLog.importConfirmTitle"),
          message: t("strengthLog.importConfirmMessage"),
          okText: t("strengthLog.importFromPlan"),
          cancelText: t("common.cancel"),
          tone: "danger",
        });
        if (!ok) return;
      }

      setImporting(true);
      const updated = await apiImportFromPlan(
        Number(userId),
        sessionId,
        planSessionId,
      );
      setImporting(false);

      if (updated) {
        setExercises(updated.log?.exercises ?? []);
        setOpenIdx((updated.log?.exercises ?? []).length ? 0 : null);
        if (updated.title) setTitle(updated.title);
        setPlanPickerOpen(false);
        toast.success(t("strengthLog.importSuccess"));
      } else {
        toast.error(t("strengthLog.importError"));
      }
    },
    [userId, sessionId, importing, exercises, t],
  );

  const mutate = useCallback(
    (exIdx: number, fn: (ex: StrengthExerciseLog) => StrengthExerciseLog) => {
      setExercises((prev) => {
        const next = [...prev];
        next[exIdx] = fn({
          ...next[exIdx],
          sets: [...(next[exIdx].sets ?? [])],
        });
        return next;
      });
      scheduleSave();
    },
    [scheduleSave],
  );

  const addSet = useCallback(
    (exIdx: number) =>
      mutate(exIdx, (ex) => {
        const last = ex.sets[ex.sets.length - 1];
        ex.sets.push({
          set_index: (last?.set_index ?? 0) + 1,
          weight_kg: last?.weight_kg ?? null,
          reps: last?.reps ?? null,
          rpe: null,
          is_warmup: false,
        });
        return ex;
      }),
    [mutate],
  );

  const removeSet = useCallback(
    (exIdx: number, sIdx: number) =>
      mutate(exIdx, (ex) => {
        ex.sets = ex.sets
          .filter((_, i) => i !== sIdx)
          .map((s, i) => ({ ...s, set_index: i + 1 }));
        return ex;
      }),
    [mutate],
  );

  const updateSet = useCallback(
    (exIdx: number, sIdx: number, patch: Partial<StrengthSetEntry>) =>
      mutate(exIdx, (ex) => {
        ex.sets = ex.sets.map((s, i) => (i === sIdx ? { ...s, ...patch } : s));
        return ex;
      }),
    [mutate],
  );

  const removeExercise = useCallback(
    (exIdx: number) => {
      setExercises((prev) => prev.filter((_, i) => i !== exIdx));
      setOpenIdx(null);
      scheduleSave();
    },
    [scheduleSave],
  );

  const replaceExercise = useCallback(
    (exIdx: number, exerciseId: string) => {
      setExercises((prev) =>
        prev.map((ex, i) =>
          i === exIdx ? { ...ex, exercise_id: exerciseId } : ex,
        ),
      );
      scheduleSave();
    },
    [scheduleSave],
  );

  const addExercise = useCallback(
    (exerciseId: string) => {
      setExercises((prev) => {
        setOpenIdx(prev.length);
        return [
        ...prev,
        {
          exercise_id: exerciseId,
          block: addBlock,
          order_index: prev.length,
          planned: null,
          sets: [
            {
              set_index: 1,
              weight_kg: null,
              reps: null,
              rpe: null,
              is_warmup: false,
            },
          ],
        },
      ];
      });
      setAddPanelOpen(false);
      setPendingExerciseId("");
      scheduleSave();
    },
    [addBlock, scheduleSave],
  );

  const grouped = useMemo(() => {
    const map = new Map<
      StrengthBlock,
      Array<{ ex: StrengthExerciseLog; idx: number }>
    >();
    exercises.forEach((ex, idx) => {
      const b = (ex.block || "strength_main_part") as StrengthBlock;
      if (!map.has(b)) map.set(b, []);
      map.get(b)!.push({ ex, idx });
    });
    return map;
  }, [exercises]);

  const totalVolume = useMemo(() => {
    let v = 0;
    for (const ex of exercises) {
      if (getExerciseMeta(ex.exercise_id).measure !== "reps") continue;
      for (const s of ex.sets ?? [])
        if (!s.is_warmup && s.weight_kg && s.reps) v += s.weight_kg * s.reps;
    }
    return Math.round(v);
  }, [exercises]);

  const prescriptionLabels = useMemo(
    () => ({
      sets: t("sessions.detail.unitSets") || "sérií",
      reps: t("sessions.detail.unitReps") || "opak.",
      rest: t("sessions.detail.unitRest") || "Pauza",
      sec: t("sessions.detail.unitSec") || "s",
    }),
    [t],
  );

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <LoadingSpinner size="button" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Akčný riadok: import z plánu, návrh cviku, help */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="secondary"
            onClick={openPlanPicker}
            disabled={importing || !sessionId}
          >
            {importing ? (
              <LoadingSpinner size="button" />
            ) : (
              t("strengthLog.importFromPlan")
            )}
          </Button>
          {/* 🌟 NOVÉ: návrh cviku, ktorý chýba v katalógu */}
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setSuggestOpen(true)}
          >
            {t("strengthLog.suggestExercise")}
          </Button>
        </div>

        <TooltipIcon
          text={t("strengthLog.help")}
          title={t("strengthLog.helpTitle")}
          size={26}
        />
      </div>

      {suggestOpen && (
        <ExerciseSuggestionModal onClose={() => setSuggestOpen(false)} />
      )}

      {planPickerOpen && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-3 flex flex-col gap-2 animate-in fade-in">
          <div className="text-xs font-semibold opacity-80">
            {t("strengthLog.importPickerTitle")}
          </div>

          {plansLoading ? (
            <div className="flex justify-center py-3">
              <LoadingSpinner size="button" />
            </div>
          ) : plannedSessions.length === 0 ? (
            <div className="text-xs opacity-40 py-2">
              {t("strengthLog.importNoPlans")}
            </div>
          ) : (
            <div className="max-h-[240px] overflow-y-auto flex flex-col gap-1">
              {plannedSessions.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleImport(p.id)}
                  disabled={importing}
                  className="text-left px-3 py-2 rounded hover:bg-white/10 transition-colors"
                >
                  <div className="text-sm font-medium truncate">
                    {p.title || t("strengthLog.widget.title")}
                  </div>
                  <div className="text-[11px] opacity-50 mt-0.5">
                    {formatPlanDate(p.plan_date)} · {p.exercise_count}{" "}
                    {t("strengthLog.exercisesUnit")}
                  </div>
                </button>
              ))}
            </div>
          )}

          <Button
            size="xs"
            variant="secondary"
            onClick={() => setPlanPickerOpen(false)}
          >
            {t("common.cancel")}
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <div className="text-xs opacity-60 mb-1">
            {t("strengthLog.dateLabel")}
          </div>
          <DateField
            value={sessionDate}
            onChange={(v) => {
              setSessionDate(v ?? "");
              scheduleSave();
            }}
          />
        </div>
        <TextField
          label={t("strengthLog.titleLabel")}
          value={title}
          maxLength={200}
          placeholder={t("strengthLog.titlePlaceholder")}
          onChange={(e) => {
            setTitle(e.target.value);
            scheduleSave();
          }}
        />
      </div>

      <div className={PLAN_STRUCT_STACK}>
        {BLOCK_ORDER.filter((b) => (grouped.get(b) ?? []).length > 0).map(
          (block) => (
            <div key={block} className={PLAN_BLOCK}>
              <div className={PLAN_BLOCK_LABEL}>
                {t(BLOCK_LABEL_KEY[block] as any)}
              </div>
              <ul className={PLAN_EX_LIST}>
                {(grouped.get(block) ?? []).map(({ ex, idx }) => {
                  const plannedLine = formatPrescription(
                    {
                      sets: ex.planned?.sets,
                      reps: ex.planned?.reps,
                      rest_s: ex.planned?.rest_s,
                      exercise_id: ex.exercise_id,
                    },
                    prescriptionLabels,
                  );
                  const workCount = loggedSetCount(ex);
                  const isOpen = openIdx === idx;
                  const meta = getExerciseMeta(ex.exercise_id);
                  const isBodyweight = meta.load_mode === "bodyweight_plus";
                  const primaryLabel =
                    meta.measure === "time"
                      ? t("strengthLog.unitSeconds") || "Sekundy"
                      : meta.measure === "distance"
                        ? t("strengthLog.unitMeters") || "Metre"
                        : t("strengthLog.repsShort") || "Opakovania";
                  const weightLabel = isBodyweight
                    ? t("strengthLog.unitExtraWeight") || "+kg"
                    : t("strengthLog.unitWeight") || "Kg";
                  const exName =
                    STRENGTH_CATALOG_FE[ex.exercise_id]?.[lang] ??
                    ex.exercise_id.replace(/_/g, " ");

                  return (
                    <li key={`${ex.exercise_id}-${idx}`} className="list-none">
                      {/* rovnaká karta ako tréningové preferencie: názov + fajka/krúžok */}
                      <InputsCardControlContext.Provider
                        value={{
                          open: isOpen,
                          onOpenChange: (o) => setOpenIdx(o ? idx : null),
                          status: workCount > 0 ? "done" : "todo",
                          statusLabel:
                            workCount > 0
                              ? `${workCount} ${t("strengthLog.setsLogged")}`
                              : t("strengthLog.notLogged"),
                        }}
                      >
                      <InputsCard title={exName} subtitle={plannedLine}>

                      <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex-1 min-w-0">
                            <ExercisePicker
                              value={ex.exercise_id}
                              onValueChange={(id) => replaceExercise(idx, id)}
                              hideMuscleHint
                            />
                            <MuscleVolumeDeltaStrip
                              kind="logged"
                              base={volumeBase}
                              onlyExerciseId={ex.exercise_id}
                              draft={exercises.map((e) => ({
                                exercise_id: e.exercise_id,
                                sets: loggedSetCount(e),
                              }))}
                            />
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeExercise(idx)}
                          className="shrink-0 w-6 h-6 rounded text-sm opacity-30 hover:opacity-100 transition-opacity"
                          style={{ color: appColors.statusError }}
                          title={t("common.delete")}
                        >
                          ×
                        </button>
                      </div>


                      <div className="mt-2 flex flex-col gap-2">
                        {(ex.sets ?? []).map((s, sIdx) => (
                          <div
                            key={sIdx}
                            className={SESSION_SUBCARD}
                            style={SESSION_SUBCARD_STYLE}
                          >
                            <div
                              className={[
                                PANEL_PAD,
                                "flex flex-col gap-2",
                              ].join(" ")}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateSet(idx, sIdx, {
                                      is_warmup: !s.is_warmup,
                                    })
                                  }
                                  title={t("strengthLog.warmupToggle")}
                                  className="text-xs font-bold uppercase tracking-wide transition-colors"
                                  style={{
                                    color: s.is_warmup
                                      ? appColors.statusWarning
                                      : appColors.textMuted,
                                  }}
                                >
                                  {s.is_warmup
                                    ? t("strengthLog.warmupLabel") ||
                                      "Rozcvička"
                                    : `${t("strengthLog.setLabel") || "Séria"} ${s.set_index}`}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeSet(idx, sIdx)}
                                  className="w-6 h-6 shrink-0 rounded text-sm opacity-30 hover:opacity-100 transition-opacity"
                                  style={{ color: appColors.statusError }}
                                >
                                  ×
                                </button>
                              </div>

                              <div className="flex gap-2">
                                <SetFieldTile label={primaryLabel}>
                                  <TextField
                                    type="number"
                                    inputMode={
                                      meta.measure === "reps"
                                        ? "numeric"
                                        : "decimal"
                                    }
                                    min={0}
                                    className="text-center text-lg font-bold w-full"
                                    placeholder="—"
                                    value={s.reps ?? ""}
                                    onChange={(e) =>
                                      updateSet(idx, sIdx, {
                                        reps:
                                          e.target.value === ""
                                            ? null
                                            : Number(e.target.value),
                                      })
                                    }
                                  />
                                </SetFieldTile>

                                <SetFieldTile label={weightLabel}>
                                  <TextField
                                    type="number"
                                    step="0.5"
                                    min={0}
                                    className="text-center text-lg font-bold w-full"
                                    placeholder="—"
                                    value={s.weight_kg ?? ""}
                                    onChange={(e) =>
                                      updateSet(idx, sIdx, {
                                        weight_kg:
                                          e.target.value === ""
                                            ? null
                                            : Number(e.target.value),
                                      })
                                    }
                                  />
                                </SetFieldTile>
                              </div>
                            </div>
                          </div>
                        ))}

                        <button
                          type="button"
                          onClick={() => addSet(idx)}
                          className="self-start text-[11px] font-semibold px-2 py-1 rounded border border-white/10 hover:border-white/30 transition-colors"
                          style={{ color: appColors.brandPrimary }}
                        >
                          + {t("strengthLog.addSet")}
                        </button>

                        {workCount > 0 && (
                          <div className="text-[10px] opacity-40">
                            {workCount} {t("strengthLog.setsLogged")}
                          </div>
                        )}
                      </div>
                      </InputsCard>
                      </InputsCardControlContext.Provider>
                    </li>
                  );
                })}
              </ul>
            </div>
          ),
        )}
      </div>

      {addPanelOpen ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-3 flex flex-col gap-2">
          <div className="flex gap-2 flex-wrap">
            {BLOCK_ORDER.map((b) => (
              <Button
                key={b}
                type="button"
                size="xs"
                variant="prefs"
                active={addBlock === b}
                onClick={() => setAddBlock(b)}
              >
                {t(BLOCK_LABEL_KEY[b] as any)}
              </Button>
            ))}
          </div>
          <ExercisePicker
            value={pendingExerciseId}
            onValueChange={(id) => addExercise(id)}
            placeholder={t("strengthLog.searchExercise")}
          />
          <Button
            size="xs"
            variant="secondary"
            onClick={() => setAddPanelOpen(false)}
          >
            {t("common.cancel")}
          </Button>
        </div>
      ) : (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            setPendingExerciseId("");
            setAddPanelOpen(true);
          }}
          className="self-start"
        >
          + {t("strengthLog.addExercise")}
        </Button>
      )}

      <div className="pt-3 border-t border-white/10 flex flex-col gap-3">
        <textarea
          className="w-full rounded bg-white/5 border border-white/10 p-2.5 text-sm text-white focus:border-white/30 focus:outline-none resize-none placeholder:text-white/20"
          rows={2}
          maxLength={500}
          value={note}
          placeholder={t("strengthLog.notePlaceholder")}
          onChange={(e) => {
            setNote(e.target.value);
            scheduleSave();
          }}
        />

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={completed}
              onChange={() => {
                setCompleted((c) => !c);
                scheduleSave();
              }}
              className="w-3.5 h-3.5 rounded border-white/20 bg-white/5 cursor-pointer"
              style={{ accentColor: appColors.brandPrimary }}
            />
            <span className="font-semibold">
              {t("strengthLog.markCompleted")}
            </span>
          </label>

          {totalVolume > 0 && (
            <div className="text-[11px] opacity-60">
              {t("strengthLog.totalVolume")}:{" "}
              <span className="font-semibold">{totalVolume} kg</span>
            </div>
          )}
        </div>

        <div className="text-[10px] min-h-[14px]">
          {saving ? (
            <span className="opacity-50">{t("strengthLog.saving")}</span>
          ) : saveError ? (
            <span style={{ color: appColors.statusError }}>
              {t("strengthLog.saveError")}
            </span>
          ) : savedAt ? (
            <span className="opacity-40">
              {t("strengthLog.savedAt")} {savedAt}
            </span>
          ) : null}
        </div>

        <Button
          size="xs"
          variant="danger"
          onClick={handleDeleteSession}
          disabled={deleting || !sessionId}
          className="self-start mt-1"
        >
          {deleting ? (
            <LoadingSpinner size="button" />
          ) : (
            t("strengthLog.deleteSession")
          )}
        </Button>
      </div>
    </div>
  );
}
