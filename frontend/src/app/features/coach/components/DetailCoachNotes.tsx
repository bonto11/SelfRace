"use client";

import { useEffect, useState } from "react";
import Button from "@/app/shared/ui/components/Button";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { toast } from "@/app/shared/ui/components/Toast";
import { confirm } from "@/app/shared/ui/components/Confirm";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { useT } from "@/app/shared/i18n/useT";
import {
  PANEL_STACK, PANEL_PAD, PANEL_INNER_STACK,
  PANEL_SECTION_HEAD, PANEL_SECTION_TITLE, PANEL_SECTION_SUBTITLE,
  ACCORDION_FOOTER_BAR_MUTED,
} from "@/app/shared/ui/tokens";
import { SESSION_CARD, SESSION_CARD_STYLE } from "@/app/shared/ui/tokens/sessionCard";
import {
  apiGetCoachNotes, apiCreateSticky, apiUpdateSticky,
  apiDeleteNote, apiAddEphemeral,
  type CoachNotesData, type StickyNote,
} from "@/app/features/coach/api/coach_user_notes";
import { apiGenerateDailyForWeek } from "@/app/features/coach/api/coach_plan_daily";
import { apiGenerateWeeklyPlan, apiGetLatestWeeklyPlan } from "@/app/features/coach/api/coach_plan_weekly";
import { apiActivePlanStatus } from "@/app/features/coach/api/coach_plan_active";

function Card({ title, subtitle, children }: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className={SESSION_CARD} style={SESSION_CARD_STYLE}>
      {(title || subtitle) && (
        <header className={[PANEL_PAD, PANEL_SECTION_HEAD].join(" ")}>
          <div className="min-w-0">
            {title && <div className={PANEL_SECTION_TITLE}>{title}</div>}
            {subtitle && <div className={PANEL_SECTION_SUBTITLE}>{subtitle}</div>}
          </div>
        </header>
      )}
      <div className={[PANEL_PAD, PANEL_INNER_STACK].join(" ")}>{children}</div>
      <div className={ACCORDION_FOOTER_BAR_MUTED} />
    </section>
  );
}

const MAX_CHARS = 500;
const MAX_REPLAN_CHARS = 300;

type LastReplan = {
  type: "daily" | "weekly";
  at: string;
  weekGoal?: string | null;
  weekNotes?: string | null;
  coachReply?: string | null;
};

export default function DetailCoachNotes() {
  const { userId, userUuid } = useUserId();
  const t = useT();

  // Notes data
  const [data, setData] = useState<CoachNotesData | null>(null);
  const [loading, setLoading] = useState(false);

  // Sticky edit/add
  const [newText, setNewText] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");

  // Replan
  const [replanNote, setReplanNote] = useState("");
  const [replanning, setReplanning] = useState<"daily" | "weekly" | null>(null);
  const [lastReplan, setLastReplan] = useState<LastReplan | null>(null);

  // 🌟 Dĺžka plánu (date picker pri "Veľká zmena") — predvyplnený aktuálnym
  // koncom plánu, athlete môže zmeniť. BE z toho vždy deterministicky
  // dopočíta počet týždňov, nezávisle od textu poznámky.
  const [targetEndDate, setTargetEndDate] = useState<string>("");
  const [targetEndDateLoaded, setTargetEndDateLoaded] = useState(false);

  // Plan status
  const [planActive, setPlanActive] = useState(false);
  const [planStatusLoading, setPlanStatusLoading] = useState(true);

  /* ---- Data fetch ---- */

  const fetchData = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await apiGetCoachNotes(userId);
      setData(res);
    } catch {
      toast.error(t("coachNotes.errorLoad"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [userId]);

  useEffect(() => {
    if (!userId) return;
    setPlanStatusLoading(true);
    apiActivePlanStatus(userId)
      .then((s) => setPlanActive(!!s?.has_active))
      .catch(() => setPlanActive(false))
      .finally(() => setPlanStatusLoading(false));
  }, [userId]);

  // 🌟 Predvyplnenie date pickera aktuálnym koncom plánu (posledný týždeň)
  useEffect(() => {
    if (!userId || targetEndDateLoaded) return;
    apiGetLatestWeeklyPlan(userId)
      .then((plan) => {
        const weeks = plan?.weeks ?? [];
        if (weeks.length === 0) return;
        const last = weeks[weeks.length - 1];
        if (last?.week_end) setTargetEndDate(last.week_end.slice(0, 10));
      })
      .catch(() => {})
      .finally(() => setTargetEndDateLoaded(true));
  }, [userId, targetEndDateLoaded]);

  /* ---- Sticky CRUD ---- */

  const canAddSticky = (data?.sticky_slots_used ?? 0) < (data?.sticky_slots_max ?? 2);

  const handleAddSticky = async () => {
    if (!userId || !newText.trim()) return;
    setSaving(true);
    try {
      const res = await apiCreateSticky(userId, newText.trim());
      if (!res.success) return toast.error(res.message ?? t("coachNotes.errorSave"));
      toast.success(t("coachNotes.saveSuccess"));
      setNewText("");
      await fetchData();
    } catch {
      toast.error(t("coachNotes.errorSave"));
    } finally {
      setSaving(false);
    }
  };

  const handleStartEdit = (note: StickyNote) => {
    setEditingId(note.id);
    setEditText(note.text);
  };

  const handleSaveEdit = async (noteId: number) => {
    if (!userId || !editText.trim()) return;
    setSaving(true);
    try {
      const res = await apiUpdateSticky(userId, noteId, editText.trim());
      if (!res.success) return toast.error(t("coachNotes.errorSave"));
      toast.success(t("coachNotes.saveSuccess"));
      setEditingId(null);
      await fetchData();
    } catch {
      toast.error(t("coachNotes.errorSave"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (noteId: number) => {
    if (!userId) return;
    const ok = await confirm({
      title: t("coachNotes.deleteConfirm.title"),
      message: t("coachNotes.deleteConfirm.message"),
      okText: t("coachNotes.deleteConfirm.ok"),
      cancelText: t("common.cancel"),
      tone: "danger",
    });
    if (!ok) return;
    try {
      await apiDeleteNote(userId, noteId);
      toast.success(t("coachNotes.deleteSuccess"));
      await fetchData();
    } catch {
      toast.error(t("coachNotes.errorDelete"));
    }
  };

  /* ---- Replan helpers ---- */

  const _saveEphemeralIfNeeded = async () => {
    const text = replanNote.trim();
    if (!userId || !text) return;
    await apiAddEphemeral(userId, text);
    setReplanNote("");
  };

  const _getCurrentWeekIndex = async (): Promise<number> => {
    if (!userId) return 1;
    try {
      const plan = await apiGetLatestWeeklyPlan(userId);
      const today = new Date().toISOString().slice(0, 10);
      const current = plan?.weeks.find(
        (w) => w.week_start && w.week_end && w.week_start <= today && w.week_end >= today
      );
      return current?.week_index ?? 1;
    } catch {
      return 1;
    }
  };

  const _fetchCurrentWeekSummary = async (): Promise<{ weekGoal?: string | null; weekNotes?: string | null }> => {
    if (!userId) return {};
    try {
      const plan = await apiGetLatestWeeklyPlan(userId);
      const today = new Date().toISOString().slice(0, 10);
      const current =
        plan?.weeks.find(
          (w) => w.week_start && w.week_end && w.week_start <= today && w.week_end >= today
        ) ?? plan?.weeks[0];
      return { weekGoal: current?.goal, weekNotes: current?.notes };
    } catch {
      return {};
    }
  };

  /* ---- Uprav dni ---- */

  const handleReplanDaily = async () => {
    if (!userId || !userUuid || replanning || !planActive) return;
    setReplanning("daily");
    setLastReplan(null);
    try {
      await _saveEphemeralIfNeeded();
      const weekIndex = await _getCurrentWeekIndex();
      const out = await apiGenerateDailyForWeek(userId, userUuid, {
        week_index: weekIndex,
        overwrite: true,
      });
      if (!out.success) {
        toast.error(out.message ?? t("coachNotes.replan.error"));
        return;
      }
      const summary = await _fetchCurrentWeekSummary();
      setLastReplan({
        type: "daily",
        at: new Date().toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit" }),
        ...summary,
      });
      toast.success(t("coachNotes.replan.successDaily"));
      await fetchData();
    } catch {
      toast.error(t("coachNotes.replan.error"));
    } finally {
      setReplanning(null);
    }
  };

  /* ---- Veľká zmena ---- */

  const handleReplanWeekly = async () => {
    if (!userId || !userUuid || replanning || !planActive) return;
    const ok = await confirm({
      title: t("coachNotes.replan.confirmWeeklyTitle"),
      message: t("coachNotes.replan.confirmWeeklyMsg"),
      okText: t("coachNotes.replan.btnWeekly"),
      cancelText: t("common.cancel"),
      tone: "danger",
    });
    if (!ok) return;
    setReplanning("weekly");
    setLastReplan(null);
    try {
      await _saveEphemeralIfNeeded();
      const wOut = await apiGenerateWeeklyPlan(userId, userUuid, {
        overwrite: true,
        // 🌟 dátum z pickera ide vždy, ak ho athlete nezmenil je to jednoducho
        // rovnaký dátum ako doteraz - BE si horizon dopočíta rovnako, žiadna
        // zmena správania pre bežný "Veľká zmena" bez úmyslu skrátiť/predĺžiť.
        target_end_date: targetEndDate || null,
      });
      if (!wOut.success) {
        toast.error(wOut.message ?? t("coachNotes.replan.error"));
        return;
      }
      await apiGenerateDailyForWeek(userId, userUuid, { week_index: 1, overwrite: true });
      const summary = await _fetchCurrentWeekSummary();
      setLastReplan({
        type: "weekly",
        at: new Date().toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit" }),
        coachReply: wOut.coach_reply ?? null,
        ...summary,
      });
      toast.success(t("coachNotes.replan.successWeekly"));
      await fetchData();
      // Po úspešnom replane si znova natiahneme aktuálny koniec plánu (mohol
      // sa zmeniť, ak athlete plán skrátil/predĺžil).
      setTargetEndDateLoaded(false);
    } catch {
      toast.error(t("coachNotes.replan.error"));
    } finally {
      setReplanning(null);
    }
  };

  if (!userId) return null;

  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <div className={PANEL_STACK}>

      {/* STICKY POZNÁMKY */}
      <Card
        title={t("coachNotes.sticky.title")}
        subtitle={t("coachNotes.sticky.subtitle")}
      >
        {loading ? (
          <div className="flex justify-center p-4"><LoadingSpinner size="button" /></div>
        ) : (
          <>
            {(data?.sticky ?? []).length > 0 && (
              <ul className="space-y-2 mb-4">
                {(data?.sticky ?? []).map((note) => (
                  <li key={note.id} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                    {editingId === note.id ? (
                      <div className="flex flex-col gap-2">
                        <textarea
                          className="w-full rounded bg-white/5 border border-white/10 p-2 text-sm text-white focus:border-white/30 focus:outline-none resize-none"
                          rows={3}
                          value={editText}
                          maxLength={MAX_CHARS}
                          onChange={(e) => setEditText(e.target.value)}
                          disabled={saving}
                        />
                        <div className="text-[10px] text-right opacity-40">{editText.length} / {MAX_CHARS}</div>
                        <div className="flex gap-2">
                          <Button size="xs" variant="primary" onClick={() => handleSaveEdit(note.id)} disabled={saving || !editText.trim()}>
                            {saving ? <LoadingSpinner size="button" /> : t("coachNotes.sticky.save")}
                          </Button>
                          <Button size="xs" variant="secondary" onClick={() => setEditingId(null)} disabled={saving}>
                            {t("common.cancel")}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm text-white/80 leading-relaxed flex-1">{note.text}</p>
                        <div className="flex gap-1 shrink-0">
                          <Button size="xs" variant="secondary" onClick={() => handleStartEdit(note)}>
                            {t("coachNotes.sticky.edit")}
                          </Button>
                          <Button size="xs" variant="danger" onClick={() => handleDelete(note.id)}>
                            🗑️
                          </Button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {canAddSticky ? (
              <div className="flex flex-col gap-2">
                <textarea
                  className="w-full rounded bg-white/5 border border-white/10 p-3 text-sm text-white focus:border-white/30 focus:outline-none resize-none placeholder:text-white/20"
                  rows={3}
                  value={newText}
                  maxLength={MAX_CHARS}
                  onChange={(e) => setNewText(e.target.value)}
                  placeholder={t("coachNotes.sticky.placeholder")}
                  disabled={saving}
                />
                {newText.length > MAX_CHARS * 0.8 && (
                  <div className="text-[10px] text-right opacity-40">{newText.length} / {MAX_CHARS}</div>
                )}
                <Button size="sm" variant="primary" onClick={handleAddSticky} disabled={saving || !newText.trim()} className="self-end">
                  {saving ? <LoadingSpinner size="button" /> : t("coachNotes.sticky.add")}
                </Button>
              </div>
            ) : (
              <div className="text-[11px] text-white/40 text-center border border-dashed border-white/10 rounded-xl p-3">
                {t("coachNotes.sticky.limitReached")}
              </div>
            )}
          </>
        )}
      </Card>

      {/* HISTÓRIA EPHEMERAL */}
      {(data?.ephemeral_history ?? []).length > 0 && (
        <Card
          title={t("coachNotes.ephemeral.title")}
          subtitle={t("coachNotes.ephemeral.subtitle")}
        >
          <ul className="space-y-2 opacity-80">
            {(data?.ephemeral_history ?? []).map((note) => (
              <li key={note.id} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 flex items-start justify-between gap-3">
                <p className="text-sm text-white/70 leading-relaxed flex-1">{note.text}</p>
                <span className={`text-[10px] font-bold uppercase shrink-0 mt-0.5 ${note.applied ? "text-emerald-400/60" : "text-yellow-400/80"}`}>
                  {note.applied ? t("coachNotes.ephemeral.applied") : t("coachNotes.ephemeral.pending")}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* PREGENEROVANIE */}
      <Card
        title={t("coachNotes.replan.title")}
        subtitle={t("coachNotes.replan.subtitle")}
      >
        <div className="flex flex-col gap-4">

          {/* Nie je aktívny plán */}
          {!planStatusLoading && !planActive && (
            <div className="p-3 rounded-xl border border-white/10 bg-white/5 text-center text-[11px] text-white/40">
              {t("coachNotes.replan.noPlan")}
            </div>
          )}

          {planStatusLoading && (
            <div className="flex justify-center py-2">
              <LoadingSpinner size="button" />
            </div>
          )}

          {!planStatusLoading && planActive && (
            <>
              {/* Ephemeral textarea */}
              <div>
                <div className="text-xs font-medium opacity-60 mb-2">
                  {t("coachNotes.replan.oneTimeLabel")}
                </div>
                <textarea
                  className="w-full rounded bg-white/5 border border-white/10 p-3 text-sm text-white focus:border-white/30 focus:outline-none resize-none placeholder:text-white/20"
                  rows={2}
                  value={replanNote}
                  maxLength={MAX_REPLAN_CHARS}
                  onChange={(e) => setReplanNote(e.target.value)}
                  placeholder={t("coachNotes.replan.oneTimePlaceholder")}
                  disabled={!!replanning}
                />
                {replanNote.length > MAX_REPLAN_CHARS * 0.8 && (
                  <div className="text-[10px] text-right opacity-40 mt-1">
                    {replanNote.length} / {MAX_REPLAN_CHARS}
                  </div>
                )}
              </div>

              {/* 🌟 Dĺžka plánu — len pri "Veľká zmena", predvyplnená aktuálnym
                  koncom plánu. Athlete ju môže zmeniť, aby plán skrátil alebo
                  predĺžil presne k danému dátumu. */}
              <div>
                <div className="text-xs font-medium opacity-60 mb-2">
                  {t("coachNotes.replan.endDateLabel")}
                </div>
                <input
                  type="date"
                  className="w-full rounded bg-white/5 border border-white/10 p-3 text-sm text-white focus:border-white/30 focus:outline-none"
                  value={targetEndDate}
                  min={todayIso}
                  onChange={(e) => setTargetEndDate(e.target.value)}
                  disabled={!!replanning}
                />
                <div className="text-[10px] text-white/30 mt-1 leading-tight">
                  {t("coachNotes.replan.endDateHint")}
                </div>
              </div>

              {/* 2 tlačidlá */}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleReplanDaily}
                  disabled={!!replanning}
                  className="flex flex-col items-center gap-0.5 !h-auto !py-3"
                >
                  {replanning === "daily" ? (
                    <LoadingSpinner size="button" />
                  ) : (
                    <>
                      <span className="text-base">📅</span>
                      <span className="text-xs font-semibold">{t("coachNotes.replan.btnDaily")}</span>
                    </>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={handleReplanWeekly}
                  disabled={!!replanning}
                  className="flex flex-col items-center gap-0.5 !h-auto !py-3"
                >
                  {replanning === "weekly" ? (
                    <LoadingSpinner size="button" />
                  ) : (
                    <>
                      <span className="text-base">🔄</span>
                      <span className="text-xs font-semibold">{t("coachNotes.replan.btnWeekly")}</span>
                    </>
                  )}
                </Button>
              </div>

              {/* Hint */}
              <div className="grid grid-cols-2 gap-2">
                <div className="text-[10px] text-white/30 text-center leading-tight">
                  {t("coachNotes.replan.hintDaily")}
                </div>
                <div className="text-[10px] text-white/30 text-center leading-tight">
                  {t("coachNotes.replan.hintWeekly")}
                </div>
              </div>

              {/* Výsledok pregenerácie */}
              {lastReplan && (
                <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex flex-col gap-2 animate-in fade-in duration-500">
                  <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                    ✓{" "}
                    {lastReplan.type === "weekly"
                      ? t("coachNotes.replan.resultWeekly")
                      : t("coachNotes.replan.resultDaily")}{" "}
                    · {lastReplan.at}
                  </div>

                  {/* 🌟 Priama odpoveď AI na poznámku (ak bola nejaká napísaná) - má
                      prioritu nad všeobecným goal/notes zhrnutím týždňa, keďže
                      priamo hovorí, čo AI so žiadosťou spravila. */}
                  {lastReplan.coachReply && (
                    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.08] p-3">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-300/80 mb-1">
                        {t("coachNotes.replan.coachReplyLabel")}
                      </div>
                      <div className="text-sm text-white/85 leading-relaxed">
                        {lastReplan.coachReply}
                      </div>
                    </div>
                  )}

                  {lastReplan.weekGoal && (
                    <div className="text-sm font-semibold text-white/90 leading-snug">
                      {lastReplan.weekGoal}
                    </div>
                  )}
                  {lastReplan.weekNotes && (
                    <div className="text-xs text-white/60 leading-relaxed italic">
                      {lastReplan.weekNotes}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </Card>

    </div>
  );
}
