// src/app/shared/components/session/SectionStrengthLog.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { useT } from "@/app/shared/i18n/useT";
import { STRENGTH_CATALOG_FE } from "@/app/shared/constants/strengthCatalog";
import { ActivitySectionShell } from "@/app/shared/components/session/DetailActivity";
import { safeText } from "@/app/shared/components/session/sessionUtils";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import {
  apiGetStrengthLog,
  apiSaveStrengthLog,
  type StrengthExerciseLog,
  type StrengthSetEntry,
} from "@/app/features/coach/api/coach_strength_log";
import {
  PLAN_STRUCT_STACK,
  PLAN_BLOCK,
  PLAN_BLOCK_LABEL,
  PLAN_EX_LIST,
  PLAN_EX_ITEM,
  PLAN_EX_ITEM_STYLE,
  PLAN_EX_NAME,
  PLAN_EX_LINE,
  PLAN_EX_NOTE,
} from "@/app/shared/ui/tokens";

const SAVE_DEBOUNCE_MS = 1200;

const BLOCK_ORDER: Array<StrengthExerciseLog["block"]> = [
  "activation",
  "strength_main_part",
  "add_ons",
];

const BLOCK_LABEL_KEY: Record<string, string> = {
  activation: "sessions.detail.plan.activation",
  strength_main_part: "sessions.detail.plan.strengthMain",
  add_ons: "sessions.detail.plan.addOns",
  main_part: "sessions.detail.plan.strengthMain",
};

type Props = {
  sessionId: number;
  /** Naplánovaná štruktúra z AI (structure.activation / strength_main_part / add_ons) */
  structure: any;
  /** true = session je dnes alebo v minulosti -> povolíme zápis odcvičeného */
  isLoggable: boolean;
  showAdvanced?: boolean;
  defaultOpen?: boolean;
};

/* ---------- helpers ---------- */

function resolveExerciseName(
  exerciseId: string | null | undefined,
  lang: "sk" | "en",
  fallbackIdx: number,
): string {
  if (exerciseId && STRENGTH_CATALOG_FE[exerciseId]) {
    return STRENGTH_CATALOG_FE[exerciseId][lang];
  }
  if (exerciseId) return exerciseId.replace(/_/g, " ");
  return `Cvik ${fallbackIdx + 1}`;
}

function formatPlanned(
  planned: StrengthExerciseLog["planned"],
  t: (k: any) => string,
): string {
  if (!planned) return "—";
  const repsString = String(planned.reps ?? "");
  const hasTimeFormat = repsString.includes("s") || repsString.includes("min");
  const formattedReps = planned.reps
    ? hasTimeFormat
      ? planned.reps
      : `${planned.reps} ${t("sessions.detail.unitReps") || "opak."}`
    : null;

  return (
    [
      planned.sets ? `${planned.sets} ${t("sessions.detail.unitSets") || "sérií"}` : null,
      formattedReps,
      planned.rest_s
        ? `${t("sessions.detail.unitRest") || "Pauza"} ${planned.rest_s}s`
        : null,
    ]
      .filter(Boolean)
      .join(" · ") || "—"
  );
}

/** Predvyplní log kostrou z AI štruktúry, ak BE ešte nič nevrátil. */
function seedFromStructure(structure: any): StrengthExerciseLog[] {
  const out: StrengthExerciseLog[] = [];
  if (!structure || typeof structure !== "object") return out;

  let order = 0;
  for (const block of BLOCK_ORDER) {
    const items = structure[block];
    if (!Array.isArray(items)) continue;
    for (const ex of items) {
      if (!ex || typeof ex !== "object") continue;
      const exId = ex.exercise_id;
      if (!exId) continue;
      out.push({
        exercise_id: String(exId),
        block,
        order_index: order,
        planned: {
          sets: ex.sets ?? null,
          reps: ex.reps ?? null,
          rest_s: ex.rest_s ?? ex.rest_sec ?? null,
        },
        sets: [],
      });
      order += 1;
    }
  }
  return out;
}

/* ---------- komponent ---------- */

export default function SectionStrengthLog({
  sessionId,
  structure,
  isLoggable,
  showAdvanced = false,
  defaultOpen = true,
}: Props) {
  const t = useT();
  const { userId } = useUserId();
  const currentLang = (t as any)?.locale?.startsWith("en") ? "en" : "sk";

  const [exercises, setExercises] = useState<StrengthExerciseLog[]>([]);
  const [completed, setCompleted] = useState(false);
  const [sessionNote, setSessionNote] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saveError, setSaveError] = useState(false);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef<{
    exercises: StrengthExerciseLog[];
    completed: boolean;
    sessionNote: string;
  }>({ exercises: [], completed: false, sessionNote: "" });

  latestRef.current = { exercises, completed, sessionNote };

  /* --- načítanie logu --- */
  useEffect(() => {
    if (!userId || !sessionId) return;
    let alive = true;

    (async () => {
      setLoading(true);
      try {
        const log = await apiGetStrengthLog(Number(userId), sessionId);
        if (!alive) return;

        if (log && Array.isArray(log.exercises) && log.exercises.length > 0) {
          setExercises(log.exercises);
          setCompleted(!!log.completed);
          setSessionNote(log.session_note ?? "");
        } else {
          // BE nemá nič (alebo prázdne) -> poskladáme z naplánovanej štruktúry
          setExercises(seedFromStructure(structure));
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [userId, sessionId, structure]);

  /* --- debounced autosave --- */
  const scheduleSave = useCallback(() => {
    if (!isLoggable || !userId || !sessionId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);

    saveTimer.current = setTimeout(async () => {
      const snapshot = latestRef.current;
      setSaving(true);
      setSaveError(false);
      const res = await apiSaveStrengthLog(Number(userId), sessionId, {
        exercises: snapshot.exercises,
        completed: snapshot.completed,
        session_note: snapshot.sessionNote || null,
      });
      setSaving(false);
      if (res) {
        setSavedAt(
          new Date().toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit" }),
        );
      } else {
        setSaveError(true);
      }
    }, SAVE_DEBOUNCE_MS);
  }, [isLoggable, userId, sessionId]);

  // uloženie rozrobeného pri odchode z komponentu
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  /* --- mutácie --- */

  const mutateExercise = useCallback(
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
    (exIdx: number) => {
      mutateExercise(exIdx, (ex) => {
        const last = ex.sets[ex.sets.length - 1];
        const nextIndex = (last?.set_index ?? 0) + 1;
        // Predvyplníme hodnotami z predošlej série - tak to robí každá
        // rozumná logovacia appka, user väčšinou mení len opakovania.
        ex.sets.push({
          set_index: nextIndex,
          weight_kg: last?.weight_kg ?? null,
          reps: last?.reps ?? null,
          rpe: null,
          is_warmup: false,
        });
        return ex;
      });
    },
    [mutateExercise],
  );

  const removeSet = useCallback(
    (exIdx: number, setIdx: number) => {
      mutateExercise(exIdx, (ex) => {
        ex.sets = ex.sets
          .filter((_, i) => i !== setIdx)
          .map((s, i) => ({ ...s, set_index: i + 1 }));
        return ex;
      });
    },
    [mutateExercise],
  );

  const updateSet = useCallback(
    (exIdx: number, setIdx: number, patch: Partial<StrengthSetEntry>) => {
      mutateExercise(exIdx, (ex) => {
        ex.sets = ex.sets.map((s, i) => (i === setIdx ? { ...s, ...patch } : s));
        return ex;
      });
    },
    [mutateExercise],
  );

  const toggleCompleted = useCallback(() => {
    setCompleted((c) => !c);
    scheduleSave();
  }, [scheduleSave]);

  /* --- zoskupenie podľa blokov --- */
  const grouped = useMemo(() => {
    const map = new Map<string, Array<{ ex: StrengthExerciseLog; idx: number }>>();
    exercises.forEach((ex, idx) => {
      const b = ex.block || "strength_main_part";
      if (!map.has(b)) map.set(b, []);
      map.get(b)!.push({ ex, idx });
    });
    return map;
  }, [exercises]);

  const totalVolume = useMemo(() => {
    let vol = 0;
    for (const ex of exercises) {
      for (const s of ex.sets ?? []) {
        if (s.is_warmup) continue;
        if (s.weight_kg && s.reps) vol += s.weight_kg * s.reps;
      }
    }
    return Math.round(vol);
  }, [exercises]);

  if (exercises.length === 0 && !loading) return null;

  const numInputClass =
    "w-[58px] rounded bg-white/5 border border-white/10 px-2 py-1 text-sm text-white text-center focus:border-white/30 focus:outline-none";

  return (
    <ActivitySectionShell
      title={t("sessions.detail.sectionExercises")}
      defaultOpen={defaultOpen}
      items={[]}
    >
      {loading ? (
        <div className="flex justify-center py-4">
          <LoadingSpinner size="button" />
        </div>
      ) : (
        <div className={PLAN_STRUCT_STACK}>
          {BLOCK_ORDER.filter((b) => (grouped.get(b) ?? []).length > 0).map((block) => (
            <div key={block} className={PLAN_BLOCK}>
              <div className={PLAN_BLOCK_LABEL}>
                {t(BLOCK_LABEL_KEY[block] as any)}
              </div>

              <ul className={PLAN_EX_LIST}>
                {(grouped.get(block) ?? []).map(({ ex, idx }) => {
                  const displayName = resolveExerciseName(
                    ex.exercise_id,
                    currentLang,
                    idx,
                  );
                  const workSets = (ex.sets ?? []).filter((s) => !s.is_warmup);

                  return (
                    <li key={`${ex.exercise_id}-${idx}`} className={PLAN_EX_ITEM} style={PLAN_EX_ITEM_STYLE}>
                      <div
                        className={PLAN_EX_NAME}
                        style={{ textTransform: "capitalize", fontWeight: 600 }}
                      >
                        {displayName}
                      </div>

                      {/* Plán */}
                      <div className={PLAN_EX_LINE}>{formatPlanned(ex.planned, t)}</div>

                      {/* Odcvičené série */}
                      {isLoggable && (
                        <div className="mt-2 flex flex-col gap-1.5">
                          {(ex.sets ?? []).map((s, sIdx) => (
                            <div key={sIdx} className="flex items-center gap-1.5 flex-wrap">
                              <button
                                type="button"
                                onClick={() =>
                                  updateSet(idx, sIdx, { is_warmup: !s.is_warmup })
                                }
                                title={t("sessions.strengthLog.warmupToggle")}
                                className="w-6 h-6 shrink-0 rounded text-[10px] font-bold border transition-colors"
                                style={{
                                  borderColor: s.is_warmup
                                    ? appColors.statusWarning
                                    : "rgba(255,255,255,0.12)",
                                  color: s.is_warmup
                                    ? appColors.statusWarning
                                    : appColors.textMuted,
                                }}
                              >
                                {s.is_warmup ? "W" : s.set_index}
                              </button>

                              <input
                                type="number"
                                inputMode="decimal"
                                step="0.5"
                                min="0"
                                className={numInputClass}
                                placeholder="kg"
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
                              <span className="text-[11px] opacity-50">kg</span>

                              <span className="text-[11px] opacity-50">×</span>

                              <input
                                type="number"
                                inputMode="numeric"
                                min="0"
                                className={numInputClass}
                                placeholder={t("sessions.strengthLog.repsShort")}
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

                              {showAdvanced && (
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  step="0.5"
                                  min="1"
                                  max="10"
                                  className={numInputClass}
                                  placeholder="RPE"
                                  value={s.rpe ?? ""}
                                  onChange={(e) =>
                                    updateSet(idx, sIdx, {
                                      rpe:
                                        e.target.value === ""
                                          ? null
                                          : Number(e.target.value),
                                    })
                                  }
                                />
                              )}

                              <button
                                type="button"
                                onClick={() => removeSet(idx, sIdx)}
                                className="ml-auto w-6 h-6 shrink-0 rounded text-sm opacity-40 hover:opacity-100 transition-opacity"
                                title={t("common.delete")}
                                style={{ color: appColors.statusError }}
                              >
                                ×
                              </button>
                            </div>
                          ))}

                          <button
                            type="button"
                            onClick={() => addSet(idx)}
                            className="self-start mt-0.5 text-[11px] font-semibold px-2 py-1 rounded border border-white/10 hover:border-white/30 transition-colors"
                            style={{ color: appColors.brandPrimary }}
                          >
                            + {t("sessions.strengthLog.addSet")}
                          </button>

                          {workSets.length > 0 && (
                            <div className="text-[10px] opacity-40 mt-0.5">
                              {workSets.length} {t("sessions.strengthLog.setsLogged")}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Poznámka k cviku z plánu */}
                      {showAdvanced && (ex as any)?.notes && (
                        <div className={PLAN_EX_NOTE}>{safeText((ex as any).notes)}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          {/* --- Pätička: poznámka, objem, stav uloženia, dokončenie --- */}
          {isLoggable && (
            <div className="mt-2 pt-3 border-t border-white/10 flex flex-col gap-3">
              <textarea
                className="w-full rounded bg-white/5 border border-white/10 p-2.5 text-sm text-white focus:border-white/30 focus:outline-none resize-none placeholder:text-white/20"
                rows={2}
                maxLength={500}
                value={sessionNote}
                placeholder={t("sessions.strengthLog.notePlaceholder")}
                onChange={(e) => {
                  setSessionNote(e.target.value);
                  scheduleSave();
                }}
              />

              <div className="flex items-center justify-between gap-3 flex-wrap">
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={completed}
                    onChange={toggleCompleted}
                    className="w-3.5 h-3.5 rounded border-white/20 bg-white/5 cursor-pointer"
                    style={{ accentColor: appColors.brandPrimary }}
                  />
                  <span className="font-semibold">
                    {t("sessions.strengthLog.markCompleted")}
                  </span>
                </label>

                {totalVolume > 0 && (
                  <div className="text-[11px] opacity-60">
                    {t("sessions.strengthLog.totalVolume")}:{" "}
                    <span className="font-semibold">{totalVolume} kg</span>
                  </div>
                )}
              </div>

              <div className="text-[10px] min-h-[14px]">
                {saving ? (
                  <span className="opacity-50">{t("sessions.strengthLog.saving")}</span>
                ) : saveError ? (
                  <span style={{ color: appColors.statusError }}>
                    {t("sessions.strengthLog.saveError")}
                  </span>
                ) : savedAt ? (
                  <span className="opacity-40">
                    {t("sessions.strengthLog.savedAt")} {savedAt}
                  </span>
                ) : null}
              </div>
            </div>
          )}
        </div>
      )}
    </ActivitySectionShell>
  );
}