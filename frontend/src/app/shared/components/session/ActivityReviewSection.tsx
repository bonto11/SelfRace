// src/app/features/activities/components/ActivityReviewSection.tsx
"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Button from "@/app/shared/ui/components/Button";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { useActivityData } from "@/app/shared/components/dataProviders/ActivityDataProvider";
import { useT } from "@/app/shared/i18n/useT";

import { apiRerunActivityReview } from "@/app/features/activities/api/activities_enrichment";

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

type Props = {
  item: ActivitySession;
  activityId: number;
};

const REFRESH_COOLDOWN_MS = 10000;

/* ================= thread types ================= */
type ReviewPayload = {
  review_text?: string;
  next_day_plan?: string;
  session_kind?: string;
  key_numbers?: { dominant_zone?: string; [k: string]: any };
  suggested_thresholds?: {
    hr_bpm?: number | null;
    pace_sec_km?: number | null;
    notes?: string;
    [k: string]: any;
  } | null;
  flags?: { needs_caution?: boolean; used_user_comment?: boolean };
  [k: string]: any;
};

type AssistantEntry = {
  role: "assistant";
  created_at?: string;
  source?: string;
  review: ReviewPayload;
};

type UserEntry = {
  role: "user";
  created_at?: string;
  comment?: string | null;
  is_race_effort?: boolean;
};

type ThreadEntry = AssistantEntry | UserEntry;

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
  if (tier === "family") return parseSafe(MAX_VERSIONS_FAMILY, 10);
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

function ThresholdCard({ thresholds, t }: { thresholds: NonNullable<ReviewPayload["suggested_thresholds"]>; t: any }) {
  return (
    <div className="overflow-hidden rounded-xl border border-emerald-500/30 bg-emerald-500/5 backdrop-blur-sm animate-in fade-in slide-in-from-top-4 duration-700">
      <div className="flex items-center gap-4 p-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20 text-2xl shadow-[0_0_15px_rgba(16,185,129,0.4)]">
          🚀
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-bold uppercase tracking-wider text-emerald-400">
            {t("sessions.review.thresholdUpdateTitle")}
          </h4>
          <p className="mt-1 text-xs leading-relaxed text-white/80">
            {thresholds.notes || t("sessions.review.thresholdUpdateDesc")}
          </p>

          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
            {thresholds.hr_bpm && (
              <div className="flex items-baseline gap-2">
                <span className="text-[10px] uppercase opacity-50 font-medium">
                  {t("sessions.review.thresholdNew")}
                </span>
                <span className="text-sm font-bold text-white">
                  {thresholds.hr_bpm} {t("common.units.hr")}
                </span>
              </div>
            )}
            {thresholds.pace_sec_km && (
              <div className="flex items-baseline gap-2">
                <span className="text-[10px] uppercase opacity-50 font-medium">
                  {t("sessions.review.thresholdPace")}
                </span>
                <span className="text-sm font-bold text-white">
                  {Math.floor(thresholds.pace_sec_km / 60)}:
                  {(thresholds.pace_sec_km % 60).toString().padStart(2, "0")} /
                  {t("common.units.km")}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-emerald-500/10 px-4 py-2 text-[10px] text-emerald-400/80 italic border-t border-emerald-500/20">
        ✨ {t("sessions.review.zonesAutoUpdated")}
      </div>
    </div>
  );
}

function AssistantBubble({ entry, t }: { entry: AssistantEntry; t: any }) {
  const r = entry.review || {};
  const reviewText = typeof r.review_text === "string" ? r.review_text.trim() : null;
  const nextDayPlan = typeof r.next_day_plan === "string" ? r.next_day_plan.trim() : null;
  const sessionKind = typeof r.session_kind === "string" ? r.session_kind : null;
  const dominantZone =
    typeof r?.key_numbers?.dominant_zone === "string" ? r.key_numbers.dominant_zone : null;
  const needsCaution = r?.flags?.needs_caution === true;

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-4 animate-in fade-in duration-500">
      <div className="flex flex-wrap gap-2">
        {sessionKind && <Chip label={t("sessions.review.tagFocus")} value={sessionKind} />}
        {dominantZone && <Chip label={t("sessions.review.tagZone")} value={dominantZone} />}
        {needsCaution && (
          <div className="inline-flex items-center gap-1 rounded-md bg-yellow-500/20 border border-yellow-500/30 px-3 py-1.5 text-xs text-yellow-200">
            ⚠️ {t("sessions.review.tagCaution")}
          </div>
        )}
      </div>

      {reviewText && (
        <div>
          <SectionTitle>{t("sessions.review.sectionReview")}</SectionTitle>
          <TextBlock>{reviewText}</TextBlock>
        </div>
      )}

      {nextDayPlan && (
        <div>
          <SectionTitle>{t("sessions.review.sectionNextDay")}</SectionTitle>
          <TextBlock>{nextDayPlan}</TextBlock>
        </div>
      )}

      {r.suggested_thresholds && <ThresholdCard thresholds={r.suggested_thresholds} t={t} />}
    </div>
  );
}

function UserBubble({ entry, t }: { entry: UserEntry; t: any }) {
  if (!entry.comment) return null;
  return (
    <div className="ml-4 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-3 animate-in fade-in duration-500">
      <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400/80 mb-1">
        {t("sessions.review.youLabel") || "Ty"}
      </div>
      <div className="text-sm text-white/80 whitespace-pre-wrap">{entry.comment}</div>
      {entry.is_race_effort && (
        <div className="mt-1 text-[10px] text-emerald-300/70">
          🏁 {t("sessions.review.raceEffortLabel")}
        </div>
      )}
    </div>
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
  const s: any | null =
    activityId != null ? (getSummary(activityId)) || null : null;
  const startDt = parseDateSafe(s?.date) || null;

  const isEligible = useMemo(() => {
    if (!startDt) return false;
    const days = (Date.now() - startDt.getTime()) / (1000 * 60 * 60 * 24);
    return days <= 7;
  }, [startDt]);

  const [thread, setThread] = useState<ThreadEntry[]>([]);
  const [comment, setComment] = useState<string>("");
  const [isRaceEffort, setIsRaceEffort] = useState<boolean>(false);

  const aiReviewVersion = useMemo(
    () => thread.filter((e) => e.role === "assistant").length,
    [thread],
  );
  const hasReview = aiReviewVersion > 0;

  const commentLen = comment.length;
  const commentTooLong = commentLen > MAX_COMMENT_CHARS;
  const showCharCount = commentLen > MAX_COMMENT_CHARS * 0.8;

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
      const t2: ThreadEntry[] = Array.isArray(data?.ai_review_thread)
        ? data.ai_review_thread
        : [];
      setThread(t2);

      // Predvyplnenie posledným komentárom sa robí LEN pri prvom načítaní stránky
      // (keď comment ešte nič neobsahuje), nie po každom refreshi — inak by sa
      // pole po odoslaní znova naplnilo starým textom namiesto zostania prázdne.
      if (!forceFetch) {
        const lastUserComment = [...t2]
          .reverse()
          .find((e): e is UserEntry => e.role === "user" && !!e.comment)?.comment;
        if (typeof lastUserComment === "string") {
          setComment((prev) => prev || lastUserComment);
        }
      }

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

  const canRerunByTier = maxVersions > 1;
  const canRerunByCount = aiReviewVersion < maxVersions;
  const canFreeRun = tierCode === "free" && aiReviewVersion === 0;
  const canRerun =
    isEligible && ((canRerunByTier && canRerunByCount) || canFreeRun);

  const onManualRefresh = async () => {
    if (refreshLocked || busyGen || busyLoad) return;
    setRefreshLocked(true);
    await loadData(true);
    setTimeout(() => {
      setRefreshLocked(false);
    }, REFRESH_COOLDOWN_MS);
  };

  const onRerun = async () => {
    if (!userId || !activityId || busyGen) return;
    setUiError(null);
    setApiNote(null);

    if (!isEligible) {
      setUiError(t("sessions.review.errorTooOld"));
      return;
    }
    if (commentTooLong) {
      setUiError(t("sessions.review.errorCommentLong"));
      return;
    }

    setBusyGen(true);
    setRefreshLocked(true);

    try {
      const c = comment.trim();

      const out = await apiRerunActivityReview(
        Number(userId),
        Number(activityId),
        {
          comment: c.length ? c : null,
          model: null,
          has_new_injury: false,
          is_race_effort: isRaceEffort,
        },
      );

      if (!out?.success) {
        const code = out?.error_code || "generic_error";
        const errorKey = `api.ai_errors.${code}`;
        const translatedError = t(errorKey as any);

        if (translatedError && translatedError !== errorKey) {
          setUiError(translatedError);
        } else {
          setUiError(t("api.ai_errors.generic_error"));
        }
      } else {
        if (out.status === "SUCCESS")
          setApiNote(t("sessions.review.api.success"));
        if (out.status === "PROCESSING")
          setApiNote(t("sessions.review.api.processing"));
        if (out.status === "QUEUED")
          setApiNote(t("sessions.review.api.queued"));

        // Vymaž pole po úspešnom odoslaní — komentár je už súčasťou threadu
        // (zobrazí sa ako UserBubble), netreba ho nechávať v textarea.
        setComment("");
        setIsRaceEffort(false);

        await loadData(true);
      }
    } catch (e: any) {
      const translatedError = t(e?.message);
      setUiError(translatedError || t("sessions.review.errorGeneric"));
    } finally {
      setBusyGen(false);
      setTimeout(() => {
        setRefreshLocked(false);
      }, REFRESH_COOLDOWN_MS);
    }
  };

  return (
    <ActivitySectionShell
      title={t("sessions.review.title")}
      defaultOpen={true}
      items={[]}
    >
      <div className="flex items-center justify-between min-h-[32px]">
        <div className="text-xs font-medium opacity-70">
          {!hasReview ? (
            !isEligible && startDt ? (
              <span className="text-yellow-500/80">
                {t("sessions.review.statusTooOld")}
              </span>
            ) : (
              <span>{t("sessions.review.statusNoReview")}</span>
            )
          ) : (
            <span>
              {(
                t("sessions.review.statusReviewCount") ||
                "Version {{version}} / {{max}}"
              )
                .replace("{{version}}", String(aiReviewVersion))
                .replace("{{max}}", String(maxVersions))}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onManualRefresh}
            disabled={busyLoad || busyGen || refreshLocked}
            className={`opacity-80 hover:opacity-100 ${refreshLocked ? "cursor-not-allowed opacity-50" : ""}`}
          >
            {refreshLocked && !busyLoad
              ? t("sessions.review.btnWait")
              : t("common.refresh")}
          </Button>

          {canRerun && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={onRerun}
              disabled={busyGen || refreshLocked}
            >
              {busyGen
                ? t("sessions.review.btnGenerating")
                : hasReview
                  ? t("sessions.review.btnReply")
                  : t("sessions.review.btnGenerate")}
            </Button>
          )}
        </div>
      </div>

      {isEligible && (
        tierCode === "free" ? (
          /* UKÁŽKA PRE FREE POUŽÍVATEĽOV */
          <div className="mt-4 mb-2 p-3.5 rounded-xl border border-white/10 bg-white/5 flex flex-col gap-1.5 animate-in fade-in">
            <div className="flex items-center gap-2 text-sm font-medium text-white/80">
              <span className="opacity-80">🔒</span> {t("sessions.review.upsellTitle")}
            </div>
            <p className="text-[11px] text-white/50 leading-relaxed">
              {t("sessions.review.upsellDesc")}
            </p>
          </div>
        ) : canRerunByCount ? (
          /* AKTÍVNE TEXTOVÉ POLE PRE PREDPLATITEĽOV */
          <div className="mt-4 mb-2">
            <textarea
              className={`w-full rounded bg-white/5 border border-white/10 p-3 text-sm text-white focus:border-white/30 focus:outline-none transition-colors placeholder:text-white/20 ${commentTooLong ? "border-red-500/50 focus:border-red-500" : ""}`}
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t("sessions.review.commentPlaceholder")}
              disabled={busyGen}
            />
            {showCharCount && (
              <div
                className={`text-[10px] text-right mt-1 ${commentTooLong ? "text-red-400" : "opacity-40"}`}
              >
                {commentLen} / {MAX_COMMENT_CHARS}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-4 mt-3">
              <label className="flex items-center gap-2 text-xs text-white/80 cursor-pointer hover:text-white transition-colors ml-auto md:ml-0">
                <input
                  type="checkbox"
                  checked={isRaceEffort}
                  onChange={(e) => setIsRaceEffort(e.target.checked)}
                  className="rounded border-white/20 bg-white/5 text-emerald-500 focus:ring-emerald-500/50 cursor-pointer w-3.5 h-3.5"
                  disabled={busyGen}
                />
                <span className="flex items-center gap-1.5 font-semibold">
                  🏁{" "}
                  {t("sessions.review.raceEffortLabel") ||
                    "Závodné tempo (Race Effort / All-out)"}
                </span>
              </label>
            </div>

            {!hasReview && !comment && (
              <div className="text-[11px] opacity-40 mt-3 pl-1">
                {t("sessions.review.commentTip")}
              </div>
            )}
          </div>
        ) : (
          /* INFO PRE PREDPLATITEĽOV, KTORÍ VYČERPALI LIMIT PRE TÚTO AKTIVITU */
          <div className="mt-4 mb-2 p-3 text-center text-[11px] text-white/40 border border-dashed border-white/10 rounded-xl">
            {t("sessions.review.limitReached")}
          </div>
        )
      )}

      {uiError && (
        <div className="mt-2 p-2 rounded bg-red-500/10 border border-red-500/20 text-xs text-red-200">
          {uiError}
        </div>
      )}
      {apiNote && !uiError && (
        <div className="mt-2 p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-200">
          {apiNote}
        </div>
      )}

      <div className="mt-6 space-y-3">
        {busyLoad ? (
          <div className="py-4 flex flex-col items-center justify-center opacity-50 space-y-2">
            <span className="text-sm">{t("sessions.review.loading")}</span>
          </div>
        ) : thread.length > 0 ? (
          thread.map((entry, idx) =>
            entry.role === "assistant" ? (
              <AssistantBubble key={`a-${idx}`} entry={entry} t={t} />
            ) : (
              <UserBubble key={`u-${idx}`} entry={entry} t={t} />
            ),
          )
        ) : (
          !busyGen && (
            <div className="py-8 text-center border border-dashed border-white/10 rounded-lg">
              <p className="text-sm opacity-50">
                {t("sessions.review.noReviewPlaceholder")}
              </p>
            </div>
          )
        )}
      </div>
    </ActivitySectionShell>
  );
}
