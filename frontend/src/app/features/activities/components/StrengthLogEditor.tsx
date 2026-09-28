// src/app/features/activities/components/StrengthLogEditor.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { useT } from "@/app/shared/i18n/useT";
import { STRENGTH_CATALOG_FE } from "@/app/shared/constants/strengthCatalog";
import { getExerciseMeta } from "@/app/shared/constants/strengthMeta";
import { formatPrescription } from "@/app/shared/utils/strengthFormat";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import Button from "@/app/shared/ui/components/Button";
import DateField from "@/app/shared/ui/components/DateField";
// 🌟 ZMENA: SelectField -> SelectFieldFilter pre oba cvikové pickery
// (výber v katalógu 81 cvikov bez filtra sa nedal scrollovať)
import SelectFieldFilter from "@/app/shared/ui/components/SelectFieldFilter";
import TextField from "@/app/shared/ui/components/TextField";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { TooltipIcon } from "@/app/shared/ui/components/Tooltip";
import { confirm } from "@/app/shared/ui/components/Confirm";
import { toast } from "@/app/shared/ui/components/Toast";
import ExerciseSuggestionModal from "@/app/features/activities/components/ExerciseSuggestionModal";
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
} from "@/app/features/activities/api/strength_sessions";
import {
  PLAN_STRUCT_STACK,
  PLAN_BLOCK,
  PLAN_BLOCK_LABEL,
  PLAN_EX_LIST,
  PLAN_EX_ITEM,
  PLAN_EX_ITEM_STYLE,
  PLAN_EX_LINE,
  SESSION_SUBCARD,
  SESSION_SUBCARD_STYLE,
  PANEL_PAD,
} from "@/app/shared/ui/tokens";

const SAVE_DEBOUNCE_MS = 1200;

const BLOCK_ORDER: StrengthBlock[] = ["activation", "strength_main_part", "add_ons"];

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

function formatPlanDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  const day = d.toLocaleDateString("sk-SK", { day: "2-digit", month: "2-digit" });
  const wd = d.toLocaleDateString("sk-SK", { weekday: "short" });
  return `${wd} · ${day}`;
}

function SetFieldTile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl border flex-1 min-w-0 px-3 py-2"
      style={{ background: appColors.backgroundAlt, borderColor: appColors.surfaceCardBorder }}
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
  const lang = (t as any)?.locale?.startsWith("en") ? "en" : "sk";

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
  const [plannedSessions, setPlannedSessions] = useState<PlannedStrengthSession[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
        setExercises(s.log?.exercises ?? []);
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
        setSavedAt(new Date().toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit" }));
      } else {
        setSaveError(true);
      }
    }, SAVE_DEBOUNCE_MS);
  }, [userId, sessionId]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

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
    const rows = await apiListPlannedStrengthSessions(userId, { days_back: 14, days_forward: 7 });
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
      const updated = await apiImportFromPlan(Number(userId), sessionId, planSessionId);
      setImporting(false);

      if (updated) {
        setExercises(updated.log?.exercises ?? []);
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
        next[exIdx] = fn({ ...next[exIdx], sets: [...(next[exIdx].sets ?? [])] });
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
        ex.sets = ex.sets.filter((_, i) => i !== sIdx).map((s, i) => ({ ...s, set_index: i + 1 }));
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
      scheduleSave();
    },
    [scheduleSave],
  );

  const replaceExercise = useCallback(
    (exIdx: number, exerciseId: string) => {
      setExercises((prev) => prev.map((ex, i) => (i === exIdx ? { ...ex, exercise_id: exerciseId } : ex)));
      scheduleSave();
    },
    [scheduleSave],
  );

  const addExercise = useCallback(
    (exerciseId: string) => {
      setExercises((prev) => [
        ...prev,
        {
          exercise_id: exerciseId,
          block: addBlock,
          order_index: prev.length,
          planned: null,
          sets: [{ set_index: 1, weight_kg: null, reps: null, rpe: null, is_warmup: false }],
        },
      ]);
      setAddPanelOpen(false);
      setPendingExerciseId("");
      scheduleSave();
    },
    [addBlock, scheduleSave],
  );

  const grouped = useMemo(() => {
    const map = new Map<StrengthBlock, Array<{ ex: StrengthExerciseLog; idx: number }>>();
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

  const catalogOptions = useMemo(
    () =>
      Object.entries(STRENGTH_CATALOG_FE)
        .map(([id, names]) => ({ value: id, label: (names as any)[lang] as string }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [lang],
  );

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
          <Button size="sm" variant="secondary" onClick={openPlanPicker} disabled={importing || !sessionId}>
            {importing ? <LoadingSpinner size="button" /> : t("strengthLog.importFromPlan")}
          </Button>
          {/* 🌟 NOVÉ: návrh cviku, ktorý chýba v katalógu */}
          <Button size="sm" variant="secondary" onClick={() => setSuggestOpen(true)}>
            {t("strengthLog.suggestExercise")}
          </Button>
        </div>

        <TooltipIcon text={t("strengthLog.help")} title={t("strengthLog.helpTitle")} size={26} />
      </div>

      {suggestOpen && <ExerciseSuggestionModal onClose={() => setSuggestOpen(false)} />}

      {planPickerOpen && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-3 flex flex-col gap-2 animate-in fade-in">
          <div className="text-xs font-semibold opacity-80">{t("strengthLog.importPickerTitle")}</div>

          {plansLoading ? (
            <div className="flex justify-center py-3">
              <LoadingSpinner size="button" />
            </div>
          ) : plannedSessions.length === 0 ? (
            <div className="text-xs opacity-40 py-2">{t("strengthLog.importNoPlans")}</div>
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
                    {formatPlanDate(p.plan_date)} · {p.exercise_count} {t("strengthLog.exercisesUnit")}
                  </div>
                </button>
              ))}
            </div>
          )}

          <Button size="xs" variant="secondary" onClick={() => setPlanPickerOpen(false)}>
            {t("common.cancel")}
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <div className="text-xs opacity-60 mb-1">{t("strengthLog.dateLabel")}</div>
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
        {BLOCK_ORDER.filter((b) => (grouped.get(b) ?? []).length > 0).map((block) => (
          <div key={block} className={PLAN_BLOCK}>
            <div className={PLAN_BLOCK_LABEL}>{t(BLOCK_LABEL_KEY[block] as any)}</div>
            <ul className={PLAN_EX_LIST}>
              {(grouped.get(block) ?? []).map(({ ex, idx }) => {
                const plannedLine = formatPrescription(
                  { sets: ex.planned?.sets, reps: ex.planned?.reps, rest_s: ex.planned?.rest_s },
                  prescriptionLabels,
                );
                const workCount = (ex.sets ?? []).filter((s) => !s.is_warmup).length;
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

                return (
                  <li key={`${ex.exercise_id}-${idx}`} className={PLAN_EX_ITEM} style={PLAN_EX_ITEM_STYLE}>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <SelectFieldFilter
                          value={ex.exercise_id}
                          onValueChange={(id) => replaceExercise(idx, id)}
                          options={catalogOptions}
                          searchPlaceholder={t("strengthLog.searchExercise")}
                        />
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

                    {plannedLine && <div className={PLAN_EX_LINE}>{plannedLine}</div>}

                    <div className="mt-2 flex flex-col gap-2">
                      {(ex.sets ?? []).map((s, sIdx) => (
                        <div key={sIdx} className={SESSION_SUBCARD} style={SESSION_SUBCARD_STYLE}>
                          <div className={[PANEL_PAD, "flex flex-col gap-2"].join(" ")}>
                            <div className="flex items-center justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => updateSet(idx, sIdx, { is_warmup: !s.is_warmup })}
                                title={t("strengthLog.warmupToggle")}
                                className="text-xs font-bold uppercase tracking-wide transition-colors"
                                style={{
                                  color: s.is_warmup ? appColors.statusWarning : appColors.textMuted,
                                }}
                              >
                                {s.is_warmup
                                  ? t("strengthLog.warmupLabel") || "Rozcvička"
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
                                  inputMode={meta.measure === "reps" ? "numeric" : "decimal"}
                                  min={0}
                                  className="text-center text-lg font-bold w-full"
                                  placeholder="—"
                                  value={s.reps ?? ""}
                                  onChange={(e) =>
                                    updateSet(idx, sIdx, {
                                      reps: e.target.value === "" ? null : Number(e.target.value),
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
                                      weight_kg: e.target.value === "" ? null : Number(e.target.value),
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
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
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
          <SelectFieldFilter
            value={pendingExerciseId}
            onValueChange={(id) => addExercise(id)}
            options={catalogOptions}
            placeholder={t("strengthLog.searchExercise")}
            searchPlaceholder={t("strengthLog.searchExercise")}
          />
          <Button size="xs" variant="secondary" onClick={() => setAddPanelOpen(false)}>
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
            <span className="font-semibold">{t("strengthLog.markCompleted")}</span>
          </label>

          {totalVolume > 0 && (
            <div className="text-[11px] opacity-60">
              {t("strengthLog.totalVolume")}: <span className="font-semibold">{totalVolume} kg</span>
            </div>
          )}
        </div>

        <div className="text-[10px] min-h-[14px]">
          {saving ? (
            <span className="opacity-50">{t("strengthLog.saving")}</span>
          ) : saveError ? (
            <span style={{ color: appColors.statusError }}>{t("strengthLog.saveError")}</span>
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
          {deleting ? <LoadingSpinner size="button" /> : t("strengthLog.deleteSession")}
        </Button>
      </div>
    </div>
  );
}
