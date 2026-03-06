"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Button from "@/app/shared/ui/components/Button";
import TextField from "@/app/shared/ui/components/TextField";
import { TooltipIcon } from "@/app/shared/ui/components/Tooltip";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { useActivityData } from "@/app/shared/components/dataProviders/ActivityDataProvider";
import { useT } from "@/app/shared/i18n/useT";

import {
  apiRerunActivityReview,
} from "@/app/features/activities/api/activities_enrichment";

import {
  apiFetchUserPref,
  apiUpsertUserPref,
} from "@/app/features/prefs/api/prefs";

import {
  getSubscriptionTier,
  subscribeSubscriptionTier,
} from "@/app/shared/state/subscriptionTierStore";

import { 
  MAX_VERSIONS_FREE, 
  MAX_VERSIONS_CLASSIC, 
  MAX_VERSIONS_PRO, 
  MAX_VERSIONS_FAMILY,
  MAX_COMMENT_CHARS,
} from "@/app/shared/config";

import type { ActivitySession } from "./SessionCard";
import { ActivitySectionShell } from "./ActivitySessionDetail";
import type { Injury, InjuryArea, InjuryType } from "@/app/features/prefs/types/prefs";

type Props = {
  item: ActivitySession;
  activityId: number;
};

const REFRESH_COOLDOWN_MS = 10000;

// ✅ Rozšírené katalógy zranení z prefs
const INJ_AREAS: InjuryArea[] = [
  "foot", "ankle", "achilles", "shin", "calf", "knee", "quad", "hamstring", 
  "glute", "hip", "psoas", "groin", "abdomen", "back", "neck", "shoulder", 
  "arm_wrist", "other"
];
const INJ_TYPES: InjuryType[] = [
  "overuse", "acute", "muscle_strain", "tendon", "stress", 
  "shin_splints", "plantar", "itb", "other"
];
const INJ_SEVERITY = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]; 

/* ================= date & tier helpers ================= */
function parseDateSafe(v: any): Date | null {
  if (!v) return null;
  const raw = String(v).trim();
  const d0 = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (d0) {
    const y = Number(d0[1]);
    const m = Number(d0[2]);
    const d = Number(d0[3]);
    const out = new Date(y, m - 1, d, 0, 0, 0, 0);
    return Number.isFinite(out.getTime()) ? out : null;
  }
  let d = new Date(raw);
  if (Number.isFinite(d.getTime())) return d;
  return null;
}

function maxVersionsForTier(tier: string): number {
  const parseSafe = (val: any, fallback: number) => {
    const num = Number(val);
    return Number.isFinite(num) && num > 0 ? num : fallback;
  };

  if (tier === "family") return parseSafe(MAX_VERSIONS_FAMILY, 4);
  if (tier === "pro") return parseSafe(MAX_VERSIONS_PRO, 3);
  if (tier === "classic") return parseSafe(MAX_VERSIONS_CLASSIC, 2);
  return parseSafe(MAX_VERSIONS_FREE, 1);
}

/* ================= UI helpers ================= */
function Chip({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-md border border-white/5 bg-white/5 px-3 py-1.5 text-xs">
      <span className="opacity-60">{label}</span>
      <span className="font-semibold text-white/90">{value}</span>
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="mb-2 text-xs font-bold uppercase tracking-wider opacity-60">
      {children}
    </div>
  );
}

function TextBlock({ children }: { children: ReactNode }) {
  return (
    <div className="whitespace-pre-wrap text-sm leading-7 text-white/80">
      {children}
    </div>
  );
}

/* ================= VYLEPŠENÝ MODAL PRE ZRANENIE ================= */
function InjuryReportModal({ 
  userId,
  open, 
  onClose, 
  onSaveSuccess 
}: { 
  userId: number;
  open: boolean; 
  onClose: () => void; 
  onSaveSuccess: (hasInjuries: boolean, isNew: boolean) => void;
}) {
  const t = useT();
  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [activeInjuries, setActiveInjuries] = useState<Injury[]>([]);
  const [addedNewInSession, setAddedNewInSession] = useState(false);
  const [draft, setDraft] = useState<Injury>({ area: "foot", type: "overuse", severity: 3, note: "" });

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (open && userId) {
      const fetchInjuries = async () => {
        setIsLoading(true);
        try {
          const prefs = await apiFetchUserPref(userId, "coach.prefs");
          if (prefs && Array.isArray(prefs.injuries)) {
            setActiveInjuries(prefs.injuries);
          } else {
            setActiveInjuries([]);
          }
        } catch (e) {
          console.error("Failed to load injuries", e);
        } finally {
          setIsLoading(false);
        }
      };
      fetchInjuries();
      setAddedNewInSession(false);
    }
  }, [open, userId]);

  const getSeverityNote = (val: number) => {
    if (val <= 3) return t("prefs.sections.injuriesSection.severityLevels.mild" as any);
    if (val <= 6) return t("prefs.sections.injuriesSection.severityLevels.moderate" as any);
    return t("prefs.sections.injuriesSection.severityLevels.critical" as any);
  };

  const handleAddDraftToList = () => {
    setActiveInjuries([...activeInjuries, { ...draft, note: draft.note?.trim() || undefined }]);
    setAddedNewInSession(true); 
    setDraft({ area: "foot", type: "overuse", severity: 3, note: "" });
  };

  const handleRemoveFromList = (index: number) => {
    setActiveInjuries(activeInjuries.filter((_, i) => i !== index));
  };

  const handleSaveChanges = async () => {
    if (!userId) return;
    setIsSaving(true);
    try {
      const currentPrefs = await apiFetchUserPref(userId, "coach.prefs") || {};
      const updatedPrefs = { ...currentPrefs, injuries: activeInjuries };
      await apiUpsertUserPref(userId, "coach.prefs", updatedPrefs);
      onSaveSuccess(activeInjuries.length > 0, addedNewInSession);
    } catch (e) {
      console.error("Failed to save injuries", e);
    } finally {
      setIsSaving(false);
    }
  };

  if (!mounted || !open) return null;

  return createPortal(
    <div 
      className="fixed inset-0 z-[2000000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={!isSaving ? onClose : undefined}
    >
      <div 
        className="w-full max-w-xl rounded-2xl bg-[#121418] border border-white/10 p-5 shadow-2xl flex flex-col max-h-[90vh]" 
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/5 shrink-0">
          <h3 className="text-sm font-bold uppercase tracking-wider opacity-90 text-white">
            {t("sessions.review.injuryModal.title" as any) || "Manage Injuries"}
          </h3>
          <button onClick={onClose} className="opacity-50 hover:opacity-100 p-1">✕</button>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center py-10 opacity-50">
            {t("common.loading" as any)}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto pr-2 space-y-6">
            
            <div className="space-y-4 bg-white/5 p-4 rounded-xl border border-white/5">
              <h4 className="text-xs font-bold uppercase text-white/60 mb-2">
                {t("sessions.review.injuryModal.addNewTitle" as any) || "Add new injury"}
              </h4>
              
              <div>
                <div className="text-[10px] uppercase font-bold opacity-50 mb-2">{t("prefs.sections.injuriesSection.areaLabel" as any)}</div>
                <div className="flex flex-wrap gap-1.5">
                  {INJ_AREAS.map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => setDraft((d) => ({ ...d, area: a }))}
                      className={`px-3 py-1.5 text-[11px] rounded-full border transition-colors ${
                        draft.area === a ? "bg-yellow-500 text-black border-yellow-500 font-bold" : "bg-black/30 text-white/70 border-white/10 hover:bg-white/10"
                      }`}
                    >
                      {t(`prefs.sections.injuriesSection.areas.${a}` as any)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-[10px] uppercase font-bold opacity-50 mb-2">{t("prefs.sections.injuriesSection.typeLabel" as any)}</div>
                <div className="flex flex-wrap gap-1.5">
                  {INJ_TYPES.map((ty) => (
                    <button
                      key={ty}
                      type="button"
                      onClick={() => setDraft((d) => ({ ...d, type: ty }))}
                      className={`px-3 py-1.5 text-[11px] rounded-full border transition-colors ${
                        draft.type === ty ? "bg-yellow-500 text-black border-yellow-500 font-bold" : "bg-black/30 text-white/70 border-white/10 hover:bg-white/10"
                      }`}
                    >
                      {t(`prefs.sections.injuriesSection.types.${ty}` as any)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[10px] uppercase font-bold opacity-50">{t("sessions.review.injuryModal.severityTitle" as any) || "Severity (1-10)"}</div>
                  <div className="text-[10px] opacity-40">{t("sessions.review.injuryModal.severityHint" as any) || "1 = mild, 10 = extreme"}</div>
                </div>
                <div className="flex gap-1 mb-2">
                  {INJ_SEVERITY.map((num) => {
                    let colorClass = "bg-black/30 border-white/10 text-white/70 hover:bg-white/10";
                    if (draft.severity === num) {
                      if (num <= 3) colorClass = "bg-emerald-500 border-emerald-500 text-black font-bold";
                      else if (num <= 6) colorClass = "bg-yellow-500 border-yellow-500 text-black font-bold";
                      else colorClass = "bg-red-500 border-red-500 text-white font-bold";
                    }
                    return (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setDraft((d) => ({ ...d, severity: num }))}
                        className={`flex-1 py-1.5 text-xs rounded border transition-colors ${colorClass}`}
                      >
                        {num}
                      </button>
                    )
                  })}
                </div>
                <div className="text-[11px] leading-relaxed p-2 rounded bg-white/5 border border-white/5 text-white/60 italic">
                  {getSeverityNote(draft.severity ?? 0)}
                </div>
              </div>

              <div>
                <div className="text-[10px] uppercase font-bold opacity-50 mb-2">{t("prefs.sections.injuriesSection.noteLabel" as any)}</div>
                <TextField
                  label=""
                  placeholder={t("prefs.sections.injuriesSection.notePlaceholder" as any) || "e.g. sharp pain..."}
                  value={draft.note ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, note: (e.target as HTMLInputElement).value }))}
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button type="button" variant="secondary" size="sm" onClick={handleAddDraftToList}>
                  {t("sessions.review.injuryModal.btnAddToList" as any) || "+ Add to list"}
                </Button>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase text-white/60 mb-3 border-b border-white/5 pb-2">
                {(t("sessions.review.injuryModal.currentStatus" as any) || "Current status ({{count}})").replace("{{count}}", String(activeInjuries.length))}
              </h4>
              {activeInjuries.length === 0 ? (
                <div className="text-xs opacity-50 italic">{t("sessions.review.injuryModal.emptyStatus" as any) || "No active injuries."}</div>
              ) : (
                <ul className="space-y-2">
                  {activeInjuries.map((inj, idx) => (
                    <li key={idx} className="flex items-center justify-between p-3 rounded-xl bg-black/30 border border-white/5">
                      <div>
                        <div className="text-sm font-semibold text-white/90">
                          {t(`prefs.sections.injuriesSection.areas.${inj.area}` as any)} · {t(`prefs.sections.injuriesSection.types.${inj.type}` as any)}
                        </div>
                        <div className="text-xs mt-1 flex items-center gap-2">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            (inj.severity || 0) <= 3 ? "bg-emerald-500/20 text-emerald-300" :
                            (inj.severity || 0) <= 6 ? "bg-yellow-500/20 text-yellow-300" : "bg-red-500/20 text-red-300"
                          }`}>
                            {(t("sessions.review.injuryModal.severityLabel" as any) || "Severity: {{severity}}/10").replace("{{severity}}", String(inj.severity || "?"))}
                          </span>
                          <span className="opacity-60">{inj.note}</span>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleRemoveFromList(idx)}
                        className="text-xs px-2 py-1 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded border border-red-500/20"
                      >
                        {t("sessions.review.injuryModal.btnRemove" as any) || "Delete"}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-white/5 flex justify-end gap-3 shrink-0">
          <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={isSaving}>
            {t("common.cancel" as any)}
          </Button>
          <Button 
            type="button" 
            variant="primary" 
            size="sm" 
            onClick={handleSaveChanges}
            disabled={isSaving || isLoading}
          >
            {isSaving ? (t("common.saving" as any) || "Saving...") : (t("common.save" as any) || "Save changes")}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ================= HLAVNÝ KOMPONENT ================= */

export default function ActivityReviewSection({ item, activityId }: Props) {
  const { userId } = useUserId();
  const t = useT();
  const { getSummary, getEnrichment } = useActivityData();

  const [tierCode, setTierCode] = useState<string>(() => {
    const storeTier = (getSubscriptionTier() || "").toLowerCase();
    return storeTier || "free";
  });

  useEffect(() => {
    return subscribeSubscriptionTier((tier) => {
      setTierCode(String(tier || "free").toLowerCase());
    });
  }, []);

  const maxVersions = useMemo(() => maxVersionsForTier(tierCode), [tierCode]);
  const s: any | null = activityId != null ? (getSummary(activityId) as any) || null : null;
  const startDt = parseDateSafe(s?.date) || null;

  const isEligible = useMemo(() => {
    if (!startDt) return false;
    const days = (Date.now() - startDt.getTime()) / (1000 * 60 * 60 * 24);
    return days <= 7;
  }, [startDt]);

  const [review, setReview] = useState<any | null>(null);
  const [aiReviewVersion, setAiReviewVersion] = useState<number>(0);
  const [comment, setComment] = useState<string>("");
  
  // ✅ Nový state pre Race Effort
  const [isRaceEffort, setIsRaceEffort] = useState<boolean>(false);

  const commentLen = comment.length;
  const commentTooLong = commentLen > MAX_COMMENT_CHARS;
  const showCharCount = commentLen > MAX_COMMENT_CHARS * 0.8;

  const [showInjuryModal, setShowInjuryModal] = useState(false);
  const [hasActiveInjuries, setHasActiveInjuries] = useState(false); 
  const [justAddedNewInjury, setJustAddedNewInjury] = useState(false);

  const [busyLoad, setBusyLoad] = useState(false);
  const [busyGen, setBusyGen] = useState(false);
  const [uiError, setUiError] = useState<string | null>(null);
  const [apiNote, setApiNote] = useState<string | null>(null);
  const [refreshLocked, setRefreshLocked] = useState(false);

  const loadData = async (forceFetch: boolean = false) => {
    if (!userId || !activityId) return;
    setBusyLoad(true);
    try {
      const data = await getEnrichment(activityId, { fetch: forceFetch });
      setReview(data?.ai_review ?? null);
      const v = Number(data?.ai_review_version ?? 0);
      setAiReviewVersion(Number.isFinite(v) && v >= 0 ? v : 0);

      const dbComment = data?.ai_review_last_user_comment;
      if (typeof dbComment === "string") setComment((prev) => prev || dbComment);
      
      const prefs = await apiFetchUserPref(Number(userId), "coach.prefs");
      setHasActiveInjuries(Array.isArray(prefs?.injuries) && prefs.injuries.length > 0);

      setUiError(null);
    } catch (e) {
      console.error("[AR] Load Error", e);
    } finally {
      setBusyLoad(false);
    }
  };

  useEffect(() => {
    loadData(false);
  }, [userId, activityId]);

  const hasReview = review != null;
  const canRerunByTier = maxVersions > 1;
  const canRerunByCount = aiReviewVersion < maxVersions;
  const canFreeRun = tierCode === "free" && aiReviewVersion === 0;
  const canRerun = isEligible && ((canRerunByTier && canRerunByCount) || canFreeRun);

  const r = review ?? {};
  const reviewText = typeof r?.review_text === "string" ? r.review_text.trim() : null;
  const nextDayPlan = typeof r?.next_day_plan === "string" ? r.next_day_plan.trim() : null;
  const sessionKind = typeof r?.session_kind === "string" ? r.session_kind : null;
  const dominantZone = typeof r?.key_numbers?.dominant_zone === "string" ? r.key_numbers.dominant_zone : null;
  const needsCaution = r?.flags?.needs_caution === true;

  const onManualRefresh = async () => {
    if (refreshLocked || busyGen || busyLoad) return;
    setRefreshLocked(true);
    await loadData(true);
    setTimeout(() => { setRefreshLocked(false); }, REFRESH_COOLDOWN_MS);
  };

  const onRerun = async () => {
    if (!userId || !activityId || busyGen) return;
    setUiError(null);
    setApiNote(null);

    if (!isEligible) { setUiError(t("sessions.review.errorTooOld" as any)); return; }
    if (commentTooLong) { setUiError(t("sessions.review.errorCommentLong" as any)); return; }

    setBusyGen(true);
    setRefreshLocked(true);

    try {
      const c = comment.trim();
      
      // ✅ Payload teraz obsahuje is_race_effort
      const out = await apiRerunActivityReview(
        Number(userId),
        Number(activityId),
        {
          comment: c.length ? c : null,
          model: null,
          has_new_injury: justAddedNewInjury,
          is_race_effort: isRaceEffort,
        },
      );

      if (!out?.ok) {
        if (out?.code === "limit_reached") {
          setUiError(t("api.activities.limitReached" as any));
        } else if (out?.code === "activity_too_old") {
          setUiError(t("api.activities.activityTooOld" as any));
        } else if (out?.code === "only_one_for_free_tier") {
          setUiError(t("api.activities.onlyOneForFreeTier" as any));
        } else if (out?.code === "duplicate_content") {
          setUiError(t("api.activities.duplicateContent" as any));
        } else if (out?.code === "activity_not_found") {
          setUiError(t("api.activities.activityNotFound" as any));
        } else {
          setUiError(t(out?.message as any) || t("sessions.review.errorRerunRejected" as any));
        }
      } else {
        if (out.status === "SUCCESS") setApiNote(t("sessions.review.api.success" as any));
        if (out.status === "PROCESSING") setApiNote(t("sessions.review.api.processing" as any));
        if (out.status === "QUEUED") setApiNote(t("sessions.review.api.queued" as any));

        await loadData(true);
        setJustAddedNewInjury(false);
      }
    } catch (e: any) {
      const translatedError = t(e?.message as any);
      setUiError(translatedError || t("sessions.review.errorGeneric" as any));
    } finally {
      setBusyGen(false);
      setTimeout(() => { setRefreshLocked(false); }, REFRESH_COOLDOWN_MS);
    }
  };

  return (
    <ActivitySectionShell title={t("sessions.review.title" as any)} defaultOpen={true} items={[]}>
      <div className="flex items-center justify-between min-h-[32px]">
        <div className="text-xs font-medium opacity-70">
          {!hasReview ? (
              (!isEligible && startDt) ? <span className="text-yellow-500/80">{t("sessions.review.statusTooOld" as any)}</span> : <span>{t("sessions.review.statusNoReview" as any)}</span>
          ) : (
            <span>
              {(t("sessions.review.statusReviewCount" as any) || "Version {{version}} / {{max}}")
                .replace("{{version}}", String(aiReviewVersion))
                .replace("{{max}}", String(maxVersions))}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onManualRefresh} disabled={busyLoad || busyGen || refreshLocked} className={`opacity-80 hover:opacity-100 ${refreshLocked ? "cursor-not-allowed opacity-50" : ""}`}>
             {refreshLocked && !busyLoad ? t("sessions.review.btnWait" as any) : t("common.refresh" as any)}
          </Button>

          {canRerun && (
            <Button type="button" variant="primary" size="sm" onClick={onRerun} disabled={busyGen || refreshLocked}>
              {busyGen ? t("sessions.review.btnGenerating" as any) : hasReview ? t("sessions.review.btnRerun" as any) : t("sessions.review.btnGenerate" as any)}
            </Button>
          )}
        </div>
      </div>

      {isEligible && canRerunByTier && (
        <div className="mt-4 mb-2">
          <textarea
            className={`w-full rounded bg-white/5 border border-white/10 p-3 text-sm text-white focus:border-white/30 focus:outline-none transition-colors placeholder:text-white/20 ${commentTooLong ? "border-red-500/50 focus:border-red-500" : ""}`}
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={t("sessions.review.commentPlaceholder" as any)}
            disabled={busyGen}
          />
          {showCharCount && (
            <div className={`text-[10px] text-right mt-1 ${commentTooLong ? "text-red-400" : "opacity-40"}`}>
              {commentLen} / {MAX_COMMENT_CHARS}
            </div>
          )}

          {/* ✅ Riadok pre Race Effort a Nahlásenie zranenia */}
          <div className="flex flex-wrap items-center gap-4 mt-3">
            <button
              onClick={() => setShowInjuryModal(true)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                hasActiveInjuries 
                  ? "bg-red-500/20 text-red-200 border-red-500/30 hover:bg-red-500/30" 
                  : "bg-white/5 text-white/70 border-white/10 hover:bg-white/10"
              }`}
            >
              <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border ${hasActiveInjuries ? "bg-red-500 border-red-500" : "border-white/30"}`}>
                {hasActiveInjuries && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                )}
              </div>
              {hasActiveInjuries 
                ? (t("sessions.review.injuryModal.alertActive" as any) || "Aktívne zranenie nahlásené") 
                : (t("sessions.review.injuryModal.alertReport" as any) || "Hlásim bolesť / zranenie")}
            </button>
            
            <label className="flex items-center gap-2 text-xs text-white/80 cursor-pointer hover:text-white transition-colors ml-auto md:ml-0">
              <input
                type="checkbox"
                checked={isRaceEffort}
                onChange={(e) => setIsRaceEffort(e.target.checked)}
                className="rounded border-white/20 bg-white/5 text-emerald-500 focus:ring-emerald-500/50 cursor-pointer w-3.5 h-3.5"
                disabled={busyGen}
              />
              <span className="flex items-center gap-1.5 font-semibold">
                🏁 {t("sessions.review.raceEffortLabel" as any) || "Závodné tempo (Race Effort / All-out)"}
              </span>
            </label>

            {hasActiveInjuries && (
               <div className="flex items-center gap-1.5 text-[11px] text-yellow-500/80">
                 <TooltipIcon text={t("sessions.review.injuryModal.tooltipActive" as any) || "⚠️ Zranenie je uložené v profile."} size={20} />
               </div>
            )}
          </div>

          {userId && (
            <InjuryReportModal 
              userId={Number(userId)}
              open={showInjuryModal}
              onClose={() => setShowInjuryModal(false)}
              onSaveSuccess={(hasInj, isNew) => {
                setHasActiveInjuries(hasInj);
                if (isNew) setJustAddedNewInjury(true); 
                setShowInjuryModal(false);
              }}
            />
          )}

          {!hasReview && !comment && <div className="text-[11px] opacity-40 mt-3 pl-1">{t("sessions.review.commentTip" as any)}</div>}
        </div>
      )}

      {uiError && <div className="mt-2 p-2 rounded bg-red-500/10 border border-red-500/20 text-xs text-red-200">{uiError}</div>}
      {apiNote && !uiError && <div className="mt-2 p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-200">{apiNote}</div>}

      <div className="mt-6 space-y-6">
        {busyLoad ? (
          <div className="py-4 flex flex-col items-center justify-center opacity-50 space-y-2">
            <span className="text-sm">{t("sessions.review.loading" as any)}</span>
          </div>
        ) : hasReview ? (
          <>
            <div className="flex flex-wrap gap-2">
              {sessionKind && <Chip label={t("sessions.review.tagFocus" as any)} value={sessionKind} />}
              {dominantZone && <Chip label={t("sessions.review.tagZone" as any)} value={dominantZone} />}
              {needsCaution && (
                <div className="inline-flex items-center gap-1 rounded-md bg-yellow-500/20 border border-yellow-500/30 px-3 py-1.5 text-xs text-yellow-200">
                  ⚠️ {t("sessions.review.tagCaution" as any)}
                </div>
              )}
            </div>
            {reviewText && (
              <div className="animate-in fade-in duration-500">
                <SectionTitle>{t("sessions.review.sectionReview" as any)}</SectionTitle>
                <TextBlock>{reviewText}</TextBlock>
              </div>
            )}
            {nextDayPlan && (
              <div className="animate-in fade-in duration-500 delay-100">
                <SectionTitle>{t("sessions.review.sectionNextDay" as any)}</SectionTitle>
                <TextBlock>{nextDayPlan}</TextBlock>
              </div>
            )}
          </>
        ) : (!busyGen && <div className="py-8 text-center border border-dashed border-white/10 rounded-lg"><p className="text-sm opacity-50">{t("sessions.review.noReviewPlaceholder" as any)}</p></div>)}
      </div>
    </ActivitySectionShell>
  );
}