// src/app/features/activities/components/StrengthLogEditor.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { useT } from "@/app/shared/i18n/useT";
import { STRENGTH_CATALOG_FE } from "@/app/shared/constants/strengthCatalog";
// 🌟 NOVÉ: measure (reps/time/distance) + load_mode (external/bodyweight_plus)
import { getExerciseMeta, repsUnitLabel } from "@/app/shared/constants/strengthMeta";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import Button from "@/app/shared/ui/components/Button";
import DateField from "@/app/shared/ui/components/DateField";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { TooltipIcon } from "@/app/shared/ui/components/Tooltip";
import { confirm } from "@/app/shared/ui/components/Confirm";
import { toast } from "@/app/shared/ui/components/Toast";
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
  PLAN_EX_NAME,
  PLAN_EX_LINE,
} from "@/app/shared/ui/tokens";
import { formatRest } from "@/app/shared/utils/strengthFormat";

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

function resolveName(exerciseId: string, lang: "sk" | "en"): string {
  const entry = STRENGTH_CATALOG_FE[exerciseId];
  if (entry) return entry[lang];
  return exerciseId.replace(/_/g, " ");
}

function formatPlanned(
  planned: StrengthExerciseLog["planned"],
  t: (k: any) => string,
): string | null {
  if (!planned) return null;
  const repsStr = String(planned.reps ?? "");
  // 🌟 ZMENA: "30-45s" (výdrž) aj "20-30m" (vzdialenosť) sa zobrazia tak,
  // ako prišli - jednotku nepridávame. Len opakovania dostanú "opak.".
  const isTimeOrDistance = /[sm]$/i.test(repsStr.trim()) || repsStr.includes("min");
  const restStr = formatRest(planned.rest_s);
  return (
    [
      planned.sets ? `${planned.sets} ${t("sessions.detail.unitSets") || "sérií"}` : null,
      planned.reps
        ? isTimeOrDistance
          ? planned.reps
          : `${planned.reps} ${t("sessions.detail.unitReps") || "opak."}`
        : null,
      restStr ? `${t("sessions.detail.unitRest") || "Pauza"} ${restStr}` : null,
    ]
      .filter(Boolean)
      .join(" · ") || null
  );
}

function formatPlanDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  const day = d.toLocaleDateString("sk-SK", { day: "2-digit", month: "2-digit" });
  const wd = d.toLocaleDateString("sk-SK", { weekday: "short" });
  return `${wd} · ${day}`;
}

export default function StrengthLogEditor({
  sessionId,
  showAdvanced = false,
  onDeleted,
}: Props) {
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

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerBlock, setPickerBlock] = useState<StrengthBlock>("strength_main_part");
  const [pickerQuery, setPickerQuery] = useState("");
  // 🌟 NOVÉ: rovnaký picker slúži aj na VÝMENU cviku. null = pridávame nový,
  // číslo = meníme cvik na tomto indexe (série ostanú zachované).
  const [replaceIdx, setReplaceIdx] = useState<number | null>(null);

  // Import z plánu
  const [planPickerOpen, setPlanPickerOpen] = useState(false);
  const [plannedSessions, setPlannedSessions] = useState<PlannedStrengthSession[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ exercises, completed, note, sessionDate, title });
  latest.current = { exercises, completed, note, sessionDate, title };

  /* --- load --- */
  useEffect(() => {
    // Bez sessionId nemáme čo načítať - zhodíme loading, nech komponent
    // nevisí na nekonečnom spinneri (stávalo sa pri renderovaní bez propu).
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

  /* --- autosave --- */
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
          new Date().toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit" }),
        );
      } else {
        setSaveError(true);
      }
    }, SAVE_DEBOUNCE_MS);
  }, [userId, sessionId]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  // Zmazanie celého zápisu. Po úspechu zavoláme onDeleted, ktorý
  // v detail stránke presmeruje späť na zoznam.
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
    // Zrušíme rozrobený autosave, nech neuloží niečo po zmazaní.
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


  /* --- import z plánu --- */
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

      // Ak už má user niečo zapísané, upozorníme - import prepíše zoznam.
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

  /* --- mutácie --- */
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
      scheduleSave();
    },
    [scheduleSave],
  );

  // 🌟 NOVÉ: otvorenie pickera nad konkrétnym cvikom = výmena cviku
  const openReplacePicker = useCallback((exIdx: number, block: StrengthBlock) => {
    setReplaceIdx(exIdx);
    setPickerBlock(block);
    setPickerQuery("");
    setPickerOpen(true);
  }, []);

  const closePicker = useCallback(() => {
    setPickerOpen(false);
    setReplaceIdx(null);
    setPickerQuery("");
  }, []);

  /**
   * 🌟 ZMENA: picker teraz buď PRIDÁ cvik, alebo VYMENÍ existujúci.
   * Pri výmene sa ukladá nové exercise_id (nie len iný text), takže
   * rotácia cvikov aj progresia (2-for-2) pracujú s tým, čo si reálne
   * odcvičil - napr. príťahy na stroji namiesto veľkej činky kvôli chrbtu.
   * Zapísané série ostávajú, `planned` tiež (je to pôvodný predpis z plánu).
   */
  const pickExercise = useCallback(
    (exerciseId: string) => {
      if (replaceIdx !== null) {
        setExercises((prev) =>
          prev.map((ex, i) => (i === replaceIdx ? { ...ex, exercise_id: exerciseId } : ex)),
        );
      } else {
        setExercises((prev) => [
          ...prev,
          {
            exercise_id: exerciseId,
            block: pickerBlock,
            order_index: prev.length,
            planned: null,
            sets: [{ set_index: 1, weight_kg: null, reps: null, rpe: null, is_warmup: false }],
          },
        ]);
      }
      closePicker();
      scheduleSave();
    },
    [replaceIdx, pickerBlock, closePicker, scheduleSave],
  );

  /* --- odvodené --- */
  const grouped = useMemo(() => {
    const map = new Map<StrengthBlock, Array<{ ex: StrengthExerciseLog; idx: number }>>();
    exercises.forEach((ex, idx) => {
      const b = (ex.block || "strength_main_part") as StrengthBlock;
      if (!map.has(b)) map.set(b, []);
      map.get(b)!.push({ ex, idx });
    });
    return map;
  }, [exercises]);

  // 🌟 ZMENA: do objemu rátame len cviky s reálnou váhou a opakovaniami.
  // Pri časových cvikoch je "reps" počet sekúnd - 45s × 0 kg je síce 0,
  // ale pri planku so závažím by to inak nafúklo objem nezmyselne.
  const totalVolume = useMemo(() => {
    let v = 0;
    for (const ex of exercises) {
      if (getExerciseMeta(ex.exercise_id).measure !== "reps") continue;
      for (const s of ex.sets ?? [])
        if (!s.is_warmup && s.weight_kg && s.reps) v += s.weight_kg * s.reps;
    }
    return Math.round(v);
  }, [exercises]);

  const catalogOptions = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    return Object.entries(STRENGTH_CATALOG_FE)
      .map(([id, names]) => ({ id, name: (names as any)[lang] as string }))
      .filter((o) => !q || o.name.toLowerCase().includes(q) || o.id.includes(q))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 40);
  }, [pickerQuery, lang]);

  const numInput =
    "w-[58px] rounded bg-white/5 border border-white/10 px-2 py-1 text-sm text-white text-center focus:border-white/30 focus:outline-none";

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <LoadingSpinner size="button" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Akčný riadok: import z plánu + help tooltip vpravo hore */}
      <div className="flex items-center justify-between gap-3">
        <Button
          size="sm"
          variant="secondary"
          onClick={openPlanPicker}
          disabled={importing || !sessionId}
        >
          {importing ? <LoadingSpinner size="button" /> : t("strengthLog.importFromPlan")}
        </Button>

        <TooltipIcon
          text={t("strengthLog.help")}
          title={t("strengthLog.helpTitle")}
          size={26}
        />
      </div>

      {/* Picker naplánovaných tréningov */}
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
                    {formatPlanDate(p.plan_date)} · {p.exercise_count}{" "}
                    {t("strengthLog.exercisesUnit")}
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

      {/* Hlavička: dátum + názov */}
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
        <div>
          <div className="text-xs opacity-60 mb-1">{t("strengthLog.titleLabel")}</div>
          <input
            className="w-full rounded bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none placeholder:text-white/20"
            value={title}
            maxLength={200}
            placeholder={t("strengthLog.titlePlaceholder")}
            onChange={(e) => {
              setTitle(e.target.value);
              scheduleSave();
            }}
          />
        </div>
      </div>

      {/* Cviky */}
      <div className={PLAN_STRUCT_STACK}>
        {BLOCK_ORDER.filter((b) => (grouped.get(b) ?? []).length > 0).map((block) => (
          <div key={block} className={PLAN_BLOCK}>
            <div className={PLAN_BLOCK_LABEL}>{t(BLOCK_LABEL_KEY[block] as any)}</div>
            <ul className={PLAN_EX_LIST}>
              {(grouped.get(block) ?? []).map(({ ex, idx }) => {
                const plannedLine = formatPlanned(ex.planned, t);
                const workCount = (ex.sets ?? []).filter((s) => !s.is_warmup).length;
                // 🌟 NOVÉ: podľa katalógu vieme, čo pri cviku pýtať
                const meta = getExerciseMeta(ex.exercise_id);
                const repsUnit = repsUnitLabel(meta.measure);
                const isBodyweight = meta.load_mode === "bodyweight_plus";
                const repsPlaceholder =
                  meta.measure === "time"
                    ? "s"
                    : meta.measure === "distance"
                      ? "m"
                      : t("strengthLog.repsShort");
                return (
                  <li key={`${ex.exercise_id}-${idx}`} className={PLAN_EX_ITEM} style={PLAN_EX_ITEM_STYLE}>
                    <div className="flex items-start justify-between gap-2">
                      {/* 🌟 ZMENA: názov je tlačidlo - klikom vymeníš cvik
                          (napr. príťahy s činkou -> na stroji kvôli chrbtu) */}
                      <button
                        type="button"
                        onClick={() => openReplacePicker(idx, block)}
                        className={`${PLAN_EX_NAME} text-left hover:opacity-80 transition-opacity`}
                        style={{ textTransform: "capitalize", fontWeight: 600 }}
                        title={t("strengthLog.changeExercise")}
                      >
                        {resolveName(ex.exercise_id, lang)}
                        <span className="ml-1 text-[11px] opacity-40">▾</span>
                      </button>
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

                    <div className="mt-2 flex flex-col gap-1.5">
                      {(ex.sets ?? []).map((s, sIdx) => (
                        <div key={sIdx} className="flex items-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => updateSet(idx, sIdx, { is_warmup: !s.is_warmup })}
                            title={t("strengthLog.warmupToggle")}
                            className="w-6 h-6 shrink-0 rounded text-[10px] font-bold border transition-colors"
                            style={{
                              borderColor: s.is_warmup
                                ? appColors.statusWarning
                                : "rgba(255,255,255,0.12)",
                              color: s.is_warmup ? appColors.statusWarning : appColors.textMuted,
                            }}
                          >
                            {s.is_warmup ? "W" : s.set_index}
                          </button>

                          {/* 🌟 ZMENA: pri bodyweight cvikoch (zhyby, kliky,
                              plank) je kg VOLITEĽNÉ prídavné závažie -
                              prázdne pole = čistá vlastná váha */}
                          <input
                            type="number"
                            inputMode="decimal"
                            step="0.5"
                            min="0"
                            className={numInput}
                            placeholder={isBodyweight ? "+kg" : "kg"}
                            value={s.weight_kg ?? ""}
                            onChange={(e) =>
                              updateSet(idx, sIdx, {
                                weight_kg: e.target.value === "" ? null : Number(e.target.value),
                              })
                            }
                          />
                          <span className="text-[11px] opacity-50">
                            {isBodyweight ? "+kg" : "kg"}
                          </span>
                          <span className="text-[11px] opacity-50">×</span>

                          {/* 🌟 ZMENA: pri výdrži sa zadávajú sekundy, pri
                              nosení metre - nie "opakovania" */}
                          <input
                            type="number"
                            inputMode="numeric"
                            min="0"
                            className={numInput}
                            placeholder={repsPlaceholder}
                            value={s.reps ?? ""}
                            onChange={(e) =>
                              updateSet(idx, sIdx, {
                                reps: e.target.value === "" ? null : Number(e.target.value),
                              })
                            }
                          />
                          {repsUnit !== "reps" && (
                            <span className="text-[11px] opacity-50">{repsUnit}</span>
                          )}

                          {showAdvanced && (
                            <input
                              type="number"
                              inputMode="decimal"
                              step="0.5"
                              min="1"
                              max="10"
                              className={numInput}
                              placeholder="RPE"
                              value={s.rpe ?? ""}
                              onChange={(e) =>
                                updateSet(idx, sIdx, {
                                  rpe: e.target.value === "" ? null : Number(e.target.value),
                                })
                              }
                            />
                          )}

                          <button
                            type="button"
                            onClick={() => removeSet(idx, sIdx)}
                            className="ml-auto w-6 h-6 shrink-0 rounded text-sm opacity-30 hover:opacity-100 transition-opacity"
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

      {/* Pridať / vymeniť cvik */}
      {pickerOpen ? (
        <div className="rounded-xl border border-white/10 bg-white/5 p-3 flex flex-col gap-2">
          {/* 🌟 NOVÉ: pri výmene je blok daný pôvodným cvikom, prepínač netreba */}
          {replaceIdx === null ? (
            <div className="flex gap-2 flex-wrap">
              {BLOCK_ORDER.map((b) => (
                <Button
                  key={b}
                  type="button"
                  size="xs"
                  variant="prefs"
                  active={pickerBlock === b}
                  onClick={() => setPickerBlock(b)}
                >
                  {t(BLOCK_LABEL_KEY[b] as any)}
                </Button>
              ))}
            </div>
          ) : (
            <div className="text-xs font-semibold opacity-80">
              {t("strengthLog.changeExerciseTitle")}
            </div>
          )}
          <input
            autoFocus
            className="w-full rounded bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none placeholder:text-white/20"
            placeholder={t("strengthLog.searchExercise")}
            value={pickerQuery}
            onChange={(e) => setPickerQuery(e.target.value)}
          />
          <div className="max-h-[220px] overflow-y-auto flex flex-col gap-1">
            {catalogOptions.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => pickExercise(o.id)}
                className="text-left text-sm px-3 py-2 rounded hover:bg-white/10 transition-colors capitalize"
              >
                {o.name}
              </button>
            ))}
            {catalogOptions.length === 0 && (
              <div className="text-xs opacity-40 px-3 py-2">{t("strengthLog.noMatch")}</div>
            )}
          </div>
          <Button size="xs" variant="secondary" onClick={closePicker}>
            {t("common.cancel")}
          </Button>
        </div>
      ) : (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            setReplaceIdx(null);
            setPickerOpen(true);
          }}
          className="self-start"
        >
          + {t("strengthLog.addExercise")}
        </Button>
      )}

      {/* Pätička */}
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
              {t("strengthLog.totalVolume")}:{" "}
              <span className="font-semibold">{totalVolume} kg</span>
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