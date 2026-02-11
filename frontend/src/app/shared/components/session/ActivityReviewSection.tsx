// src/app/shared/components/session/ActivityReviewSection.tsx
"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

import Button from "@/app/shared/ui/components/Button";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { useActivityData } from "@/app/shared/components/dataProviders/ActivityDataProvider";

import {
  // apiGetActivityReview, // ❌ TOTO UŽ NEPOTREBUJEME, rieši to Provider
  apiRerunActivityReview,
} from "@/app/features/activities/api/activities_enrichment";

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
const REFRESH_COOLDOWN_MS = 10000; // 10 sekúnd

/* ================= date helpers ================= */

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

/* ================= tier helpers ================= */
function maxVersionsForTier(tier: string): number {
  if (tier === "pro") return 3;
  if (tier === "classic") return 2;
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

/* ================= component ================= */

export default function ActivityReviewSection({ item, activityId }: Props) {
  const { userId } = useUserId();

  // ✅ Použitie nového API z providera
  const { getSummary, getEnrichment } = useActivityData();

  const [tierCode, setTierCode] = useState<string>(() => {
    // Toto je trochu hack na získanie tieru, ideálne by to malo byť v context provideri,
    // ale nechávam tvoju logiku
    const storeTier = (getSubscriptionTier() || "").toLowerCase();
    // activityData tu nemám priamo dostupné ako objekt s init, tak fallbackujem na store
    return storeTier || "free";
  });

  useEffect(() => {
    return subscribeSubscriptionTier((t) => {
      setTierCode(String(t || "free").toLowerCase());
    });
  }, []);

  const maxVersions = useMemo(() => maxVersionsForTier(tierCode), [tierCode]);
  const s: any | null =
    activityId != null ? (getSummary(activityId) as any) || null : null;
  const startDt = parseDateSafe(s?.date) || null;

  const isEligible = useMemo(() => {
    if (!startDt) return false;
    const days = (Date.now() - startDt.getTime()) / (1000 * 60 * 60 * 24);
    return days <= 7;
  }, [startDt]);

  // Data state
  const [review, setReview] = useState<any | null>(null);
  const [aiReviewVersion, setAiReviewVersion] = useState<number>(0);
  const [lastUserComment, setLastUserComment] = useState<string | null>(null);

  const [comment, setComment] = useState<string>("");
  const commentLen = comment.length;
  const commentTooLong = commentLen > MAX_COMMENT_CHARS;
  const showCharCount = commentLen > MAX_COMMENT_CHARS * 0.8;

  const [busyLoad, setBusyLoad] = useState(false);
  const [busyGen, setBusyGen] = useState(false);
  const [uiError, setUiError] = useState<string | null>(null);

  // Refresh cooldown state
  const [refreshLocked, setRefreshLocked] = useState(false);

  // ✅ LOAD DATA (cez Provider)
  const loadData = async (forceFetch: boolean = false) => {
    if (!userId || !activityId) return;

    setBusyLoad(true);
    try {
      // Voláme providera. Ak forceFetch=false, skúsi najprv cache.
      const data = await getEnrichment(activityId, { fetch: forceFetch });

      // Mapovanie dát z enrichment objektu do state
      setReview(data?.ai_review ?? null);

      const v = Number(data?.ai_review_version ?? 0);
      setAiReviewVersion(Number.isFinite(v) && v >= 0 ? v : 0);

      const dbComment = data?.ai_review_last_user_comment;
      if (typeof dbComment === "string") {
        setLastUserComment(dbComment);
        // Ak užívateľ ešte nič nenapísal do inputu, predvyplníme posledný komentár
        setComment((prev) => prev || dbComment);
      }

      setUiError(null);
    } catch (e) {
      console.error("[AR] Load Error", e);
      // Nemusíme nutne zobrazovať UI error pre load, stačí console
    } finally {
      setBusyLoad(false);
    }
  };

  // Initial load (skúsi cache, potom API)
  useEffect(() => {
    loadData(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, activityId]);

  // Eligibility logic
  const hasReview = review != null;
  const canRerunByTier = maxVersions > 1;
  const canRerunByCount = aiReviewVersion < maxVersions;
  const canFreeRun = tierCode === "free" && aiReviewVersion === 0;
  const canRerun =
    isEligible && ((canRerunByTier && canRerunByCount) || canFreeRun);

  // Parsing review content
  const r = review ?? {};
  const reviewText =
    typeof r?.review_text === "string" ? r.review_text.trim() : null;
  const nextDayPlan =
    typeof r?.next_day_plan === "string" ? r.next_day_plan.trim() : null;
  const sessionKind =
    typeof r?.session_kind === "string" ? r.session_kind : null;
  const dominantZone =
    typeof r?.key_numbers?.dominant_zone === "string"
      ? r.key_numbers.dominant_zone
      : null;
  const needsCaution = r?.flags?.needs_caution === true;

  // --- Handlers ---

  const onManualRefresh = async () => {
    if (refreshLocked || busyGen || busyLoad) return;

    setRefreshLocked(true); // Lock button

    // ✅ Force fetch cez providera
    await loadData(true);

    // Unlock after 10 seconds
    setTimeout(() => {
      setRefreshLocked(false);
    }, REFRESH_COOLDOWN_MS);
  };

  const onRerun = async () => {
    if (!userId || !activityId || busyGen) return;
    setUiError(null);

    if (!isEligible) {
      setUiError("Aktivita je príliš stará.");
      return;
    }
    if (commentTooLong) {
      setUiError("Komentár je príliš dlhý.");
      return;
    }

    setBusyGen(true);
    setRefreshLocked(true);

    try {
      const c = comment.trim();
      // Toto volanie ostáva priame na API (POST request)
      const out = await apiRerunActivityReview(
        Number(userId),
        Number(activityId),
        {
          comment: c.length ? c : null,
          model: null,
        },
      );

      if (!out?.ok) {
        setUiError(out?.message || "Požiadavka zamietnutá.");
      } else {
        // Success - teraz musíme obnoviť dáta
        // Počkáme chvíľku (voliteľné), lebo backend spúšťa job asynchrónne,
        // ale tvoja API funkcia čaká na výsledok (sync execution), takže môžeme hneď reloadnúť.
        await loadData(true);
      }
    } catch (e: any) {
      setUiError(e?.message || "Chyba pri generovaní.");
    } finally {
      setBusyGen(false);
      setTimeout(() => {
        setRefreshLocked(false);
      }, REFRESH_COOLDOWN_MS);
    }
  };

  // Status Note Component
  let statusNote: ReactNode = null;
  if (!hasReview) {
    if (!isEligible && startDt) {
      statusNote = (
        <span className="text-yellow-500/80">
          Aktivita je staršia ako 7 dní.
        </span>
      );
    } else {
      statusNote = <span>Zatiaľ bez hodnotenia.</span>;
    }
  } else {
    statusNote = (
      <div className="flex items-center gap-2">
        <span>
          Review {aiReviewVersion}/{maxVersions}
        </span>
      </div>
    );
  }

  return (
    <ActivitySectionShell
      title="Coach Hodnotenie"
      defaultOpen={true}
      items={[]}
    >
      {/* 1. Top Bar: Status + Actions */}
      <div className="flex items-center justify-between min-h-[32px]">
        <div className="text-xs font-medium opacity-70">{statusNote}</div>

        <div className="flex items-center gap-2">
          {/* Refresh Button */}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onManualRefresh}
            disabled={busyLoad || busyGen || refreshLocked}
            className={`opacity-80 hover:opacity-100 ${refreshLocked ? "cursor-not-allowed opacity-50" : ""}`}
            title="Obnoviť dáta"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`mr-1 ${busyLoad ? "animate-spin" : ""}`}
            >
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
              <path d="M3 21v-5h5" />
            </svg>
            {refreshLocked && !busyLoad ? "Čakajte" : "Obnoviť"}
          </Button>

          {/* Generate Button */}
          {canRerun && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={onRerun}
              disabled={busyGen || refreshLocked}
              className="opacity-90 hover:opacity-100"
            >
              {busyGen
                ? "Generujem..."
                : hasReview
                  ? "Prepočítať"
                  : "Vygenerovať"}
            </Button>
          )}
        </div>
      </div>

      {/* 2. User Input (Comment) */}
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
            disabled={busyGen}
          />
          {showCharCount && (
            <div
              className={`text-[10px] text-right mt-1 ${commentTooLong ? "text-red-400" : "opacity-40"}`}
            >
              {commentLen} / {MAX_COMMENT_CHARS}
            </div>
          )}
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
          <div className="py-4 flex flex-col items-center justify-center opacity-50 space-y-2">
            <svg
              className="animate-spin h-6 w-6 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <span className="text-sm">Načítavam hodnotenie...</span>
          </div>
        ) : hasReview ? (
          <>
            {/* Tags */}
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
              <div className="animate-in fade-in duration-500">
                <SectionTitle>Hodnotenie Tréningu</SectionTitle>
                <TextBlock>{reviewText}</TextBlock>
              </div>
            )}

            {/* Next Day */}
            {nextDayPlan && (
              <div className="animate-in fade-in duration-500 delay-100">
                <SectionTitle>Odporúčanie na zajtra</SectionTitle>
                <TextBlock>{nextDayPlan}</TextBlock>
              </div>
            )}
          </>
        ) : (
          !busyGen && (
            <div className="py-8 text-center border border-dashed border-white/10 rounded-lg">
              <p className="text-sm opacity-50">Zatiaľ žiadne hodnotenie.</p>
              {canRerun && (
                <p className="text-xs opacity-30 mt-1">
                  Klikni na tlačidlo hore pre vygenerovanie.
                </p>
              )}
            </div>
          )
        )}
      </div>
    </ActivitySectionShell>
  );
}
