// src/app/shared/components/session/ActivityReviewSection.tsx
"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

import Button from "@/app/shared/ui/components/Button";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { useActivityData } from "@/app/shared/components/dataProviders/ActivityDataProvider";

import {
  apiGetActivityReview,
  apiRerunActivityReview,
} from "@/app/features/activities/api/activity_review";

import {
  getSubscriptionTier,
  subscribeSubscriptionTier,
} from "@/app/shared/state/subscriptionTierStore";

import type { ActivitySession } from "./SessionCard";
import { ActivitySectionShell } from "./ActivitySessionDetail";

type Props = {
  item: ActivitySession;
  activityId: number;
};

const MAX_COMMENT_CHARS = 900;

/* ================= date helpers ================= */

function parseDateSafe(v: any): Date | null {
  if (!v) return null;
  const raw = String(v).trim();
  // ... (date logic same as before)
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

function formatUpdatedAt(v: any): string | null {
  const d = parseDateSafe(v);
  if (!d) return null;
  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function safeJson(v: any): string {
  try {
    return JSON.stringify(v ?? null, null, 2);
  } catch {
    return String(v);
  }
}

/* ================= tier helpers ================= */

function getTierCodeFromInit(activityData: any): string {
  const v =
    activityData?.init?.user?.app_subscription_tier ??
    activityData?.init?.app?.tier_code ??
    "free";
  return String(v || "free").toLowerCase();
}

function maxVersionsForTier(tier: string): number {
  if (tier === "pro") return 50;
  if (tier === "classic") return 3;
  return 1;
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
  return <div className="mb-2 text-xs font-bold uppercase tracking-wider opacity-60">{children}</div>;
}

function TextBlock({ children }: { children: ReactNode }) {
  return (
    <div className="whitespace-pre-wrap text-sm leading-7 text-white/80">
      {children}
    </div>
  );
}

/* ================= component ================= */

export default function ActivityReviewSection({ item, activityId }: Props) {
  const { userId } = useUserId();
  const activityData: any = useActivityData() as any;
  const { getSummary } = activityData;

  const [tierCode, setTierCode] = useState<string>(() => {
    const storeTier = (getSubscriptionTier() || "").toLowerCase();
    return storeTier || getTierCodeFromInit(activityData) || "free";
  });

  useEffect(() => {
    const initTier = getTierCodeFromInit(activityData);
    const storeTier = (getSubscriptionTier() || "free").toLowerCase();
    if (initTier && initTier !== "free" && storeTier === "free") {
      setTierCode(initTier.toLowerCase());
    }
    return subscribeSubscriptionTier((t) => {
      setTierCode(String(t || "free").toLowerCase());
    });
  }, [activityData]);

  const maxVersions = useMemo(() => maxVersionsForTier(tierCode), [tierCode]);
  const s: any | null = activityId != null ? (getSummary(activityId) as any) || null : null;
  const startDt = parseDateSafe(s?.date) || null;

  const isEligible = useMemo(() => {
    if (!startDt) return false;
    const days = (Date.now() - startDt.getTime()) / (1000 * 60 * 60 * 24);
    return days <= 7;
  }, [startDt]);

  // Data state
  const [review, setReview] = useState<any | null>(null);
  const [aiReviewVersion, setAiReviewVersion] = useState<number>(0);
  // Last used comment from DB to prefill
  const [lastUserComment, setLastUserComment] = useState<string | null>(null);

  const [comment, setComment] = useState<string>("");
  const commentLen = comment.length;
  const commentTooLong = commentLen > MAX_COMMENT_CHARS;
  const showCharCount = commentLen > MAX_COMMENT_CHARS * 0.8; // Show only if near limit

  const [busyLoad, setBusyLoad] = useState(false);
  const [busyGen, setBusyGen] = useState(false);
  const [uiError, setUiError] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(false);

  const reload = async () => {
    if (!userId || !activityId) return;
    setBusyLoad(true);
    try {
      const out = await apiGetActivityReview(Number(userId), Number(activityId));
      setReview(out?.review ?? null);
      
      const v = Number((out as any)?.ai_review_version ?? 0);
      setAiReviewVersion(Number.isFinite(v) && v >= 0 ? v : 0);

      const dbComment = (out as any)?.ai_review_last_user_comment;
      if (typeof dbComment === "string") {
          setLastUserComment(dbComment);
          // Prefill ONLY if current comment is empty (don't overwrite user input)
          setComment((prev) => prev || dbComment);
      }
      
      setUiError(null);
    } catch (e) {
      console.error("[AR] Load Error", e);
    } finally {
      setBusyLoad(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, activityId]);

  const hasReview = review != null;
  const canRerunByTier = maxVersions > 1; // Classic or Pro
  const canRerunByCount = aiReviewVersion < maxVersions;
  // Free tier logic: Can run ONCE (version 0->1), but without comment
  const canFreeRun = tierCode === "free" && aiReviewVersion === 0;

  const canRerun = isEligible && ( (canRerunByTier && canRerunByCount) || canFreeRun );

  // Parsing review content
  const r = review ?? {};
  const reviewText = typeof r?.review_text === "string" ? r.review_text.trim() : null;
  const nextDayPlan = typeof r?.next_day_plan === "string" ? r.next_day_plan.trim() : null;
  const sessionKind = typeof r?.session_kind === "string" ? r.session_kind : null;
  const dominantZone = typeof r?.key_numbers?.dominant_zone === "string" ? r.key_numbers.dominant_zone : null;
  const needsCaution = r?.flags?.needs_caution === true;

  // Header Status Note
  let statusNote: ReactNode = null;
  if (!hasReview) {
     if (!isEligible && startDt) {
         statusNote = <span className="text-yellow-500/80">Aktivita je staršia ako 7 dní.</span>;
     } else {
         statusNote = <span>Zatiaľ bez hodnotenia.</span>;
     }
  } else {
      statusNote = (
          <div className="flex items-center gap-2">
              <span>Coach verzia {aiReviewVersion}</span>
              {canRerunByTier && aiReviewVersion < maxVersions && (
                  <span className="opacity-50 text-[10px]">({maxVersions - aiReviewVersion} ostáva)</span>
              )}
          </div>
      );
  }

  const onRerun = async () => {
    if (!userId || !activityId || busyGen) return;
    setUiError(null);

    // Basic validation
    if (!isEligible) {
        setUiError("Aktivita je príliš stará.");
        return;
    }
    if (commentTooLong) {
        setUiError("Komentár je príliš dlhý.");
        return;
    }

    setBusyGen(true);
    try {
      const c = comment.trim();
      const out = await apiRerunActivityReview(Number(userId), Number(activityId), {
        comment: c.length ? c : null,
        model: null,
      });

      if (!out?.ok) {
        setUiError(out?.message || "Požiadavka zamietnutá.");
      } else {
        // Success
      }
      await reload();
    } catch (e: any) {
      setUiError(e?.message || "Chyba pri generovaní.");
    } finally {
      setBusyGen(false);
    }
  };

  return (
    <ActivitySectionShell title="Coach Hodnotenie" defaultOpen={true} items={[]}>
      
      {/* 1. Top Bar: Status + Action */}
      <div className="flex items-center justify-between min-h-[32px]">
        <div className="text-xs font-medium opacity-70">{statusNote}</div>
        
        {/* Action Button */}
        {canRerun && (
             <Button
                type="button"
                variant="primary" // or "secondary" depending on design
                size="sm"
                onClick={onRerun}
                disabled={busyGen}
                className="opacity-90 hover:opacity-100"
            >
                {busyGen ? "Generujem..." : hasReview ? "Prepočítať" : "Vygenerovať Review"}
            </Button>
        )}
      </div>

      {/* 2. User Input (Comment) - Only for Classic/Pro & Eligible */}
      {isEligible && canRerunByTier && (
        <div className="mt-4 mb-2">
            <textarea
                className={`w-full rounded bg-white/5 border border-white/10 p-3 text-sm text-white focus:border-white/30 focus:outline-none transition-colors placeholder:text-white/20
                    ${commentTooLong ? "border-red-500/50 focus:border-red-500" : ""}
                `}
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Napíš poznámku pre AI... (napr. 'Cítil som sa unavený', 'Bežal som v kopcoch')"
            />
            {/* Char count only if needed */}
            {showCharCount && (
                <div className={`text-[10px] text-right mt-1 ${commentTooLong ? "text-red-400" : "opacity-40"}`}>
                    {commentLen} / {MAX_COMMENT_CHARS}
                </div>
            )}
            
            {/* Quick Hints (Optional) */}
            {!hasReview && !comment && (
                <div className="text-[11px] opacity-40 mt-1 pl-1">
                    Tip: Komentár pomôže AI lepšie pochopiť kontext tvojho tréningu.
                </div>
            )}
        </div>
      )}

      {uiError && (
          <div className="mt-2 p-2 rounded bg-red-500/10 border border-red-500/20 text-xs text-red-200">
              {uiError}
          </div>
      )}

      {/* 3. Review Content */}
      <div className="mt-6 space-y-6">
        {busyLoad ? (
             <div className="py-4 text-center opacity-40 text-sm animate-pulse">Načítavam hodnotenie...</div>
        ) : hasReview ? (
            <>
                {/* Tags / Chips Row */}
                <div className="flex flex-wrap gap-2">
                    {sessionKind && <Chip label="Focus" value={sessionKind} />}
                    {dominantZone && <Chip label="Zóna" value={dominantZone} />}
                    {needsCaution && (
                        <div className="inline-flex items-center gap-1 rounded-md bg-yellow-500/20 border border-yellow-500/30 px-3 py-1.5 text-xs text-yellow-200">
                            ⚠️ Vyžaduje pozornosť
                        </div>
                    )}
                </div>

                {/* Main Text */}
                {reviewText && (
                    <div>
                        <SectionTitle>Hodnotenie Tréningu</SectionTitle>
                        <TextBlock>{reviewText}</TextBlock>
                    </div>
                )}

                {/* Next Day */}
                {nextDayPlan && (
                    <div>
                         <SectionTitle>Odporúčanie na zajtra</SectionTitle>
                         <TextBlock>{nextDayPlan}</TextBlock>
                    </div>
                )}
            </>
        ) : (
            !busyGen && (
                <div className="py-8 text-center border border-dashed border-white/10 rounded-lg">
                    <p className="text-sm opacity-50">Zatiaľ žiadne hodnotenie.</p>
                    {canRerun && <p className="text-xs opacity-30 mt-1">Klikni na tlačidlo hore pre vygenerovanie.</p>}
                </div>
            )
        )}
      </div>

      {/* 4. Debug Section (Hidden by default) */}
      <div className="mt-8 pt-4 border-t border-white/5">
        <button
            onClick={() => setShowDebug(!showDebug)}
            className="text-[10px] uppercase tracking-widest opacity-20 hover:opacity-50 transition-opacity"
        >
            {showDebug ? "Hide Debug" : "Debug Info"}
        </button>
        {showDebug && review && (
            <pre className="mt-2 p-2 bg-black/50 rounded text-[10px] text-green-400 overflow-auto max-h-60">
                {safeJson(review)}
            </pre>
        )}
      </div>

    </ActivitySectionShell>
  );
}