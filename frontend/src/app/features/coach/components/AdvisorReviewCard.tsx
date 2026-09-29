// src/app/features/coach/components/AdvisorReviewCard.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { useT } from "@/app/shared/i18n/useT";
import Button from "@/app/shared/ui/components/Button";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { toast } from "@/app/shared/ui/components/Toast";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import AiUsageWarningBanner from "@/app/features/billing/components/AiUsageWarningBanner";
import {
  apiAnalyzeAthleteState,
  apiGetLatestAthleteState,
} from "@/app/features/coach/api/coach_athlete_state";

import {
  PANEL_PAD,
  PANEL_INNER_STACK,
  PANEL_SECTION_HEAD,
  PANEL_SECTION_TITLE,
  PANEL_SECTION_SUBTITLE,
  PANEL_PREVIEW,
  ACCORDION_FOOTER_BAR_MUTED,
} from "@/app/shared/ui/tokens";
import { SESSION_CARD, SESSION_CARD_STYLE } from "@/app/shared/ui/tokens/sessionCard";

type AdvisorReview = {
  headline?: string | null;
  last_week?: {
    assessment?: string | null;
    went_well?: string[] | null;
    to_improve?: string[] | null;
  } | null;
  upcoming_check?: string[] | null;
  next_week_guidance?: {
    summary?: string | null;
    suggested_structure?: string[] | null;
  } | null;
  health_warning?: string | null;
};

function formatDateTime(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("sk-SK", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function BulletList({ items }: { items?: string[] | null }) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2 text-sm leading-snug">
          <span className="shrink-0 opacity-50">•</span>
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

function SubTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] uppercase tracking-wider font-semibold opacity-50 mt-1">
      {children}
    </div>
  );
}

/**
 * 🌟 NOVÉ: advisor hodnotenie týždňa - číta advisor_review z posledného
 * athlete state. Generuje sa automaticky v nedeľu 23:00, alebo na požiadanie
 * cez "Skontroluj mi týždeň" (existujúci ai_analyze flow).
 */
export default function AdvisorReviewCard() {
  const t = useT();
  const { userId, userUuid } = useUserId();

  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [review, setReview] = useState<AdvisorReview | null>(null);
  const [createdAt, setCreatedAt] = useState<string | null>(null);

  const loadLatest = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const latest: any = await apiGetLatestAthleteState(userId).catch(() => null);
      const st = latest?.state ?? latest?.state_json ?? null;
      setReview((st?.advisor_review as AdvisorReview) ?? null);
      setCreatedAt(latest?.created_at ?? null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadLatest();
  }, [loadLatest]);

  const handleAnalyze = useCallback(async () => {
    if (!userId || !userUuid || analyzing) return;
    setAnalyzing(true);
    setQuotaExceeded(false);
    try {
      const out: any = await apiAnalyzeAthleteState(userId, userUuid);
      if (!out?.success) {
        if (out?.code === "ai_quota_exceeded" || out?.error_code === "ai_quota_exceeded") {
          setQuotaExceeded(true);
        }
        toast.error(t("advisorReview.error" as any) || "Hodnotenie sa nepodarilo.");
        return;
      }
      await loadLatest();
      toast.success(t("advisorReview.success" as any) || "Hodnotenie je pripravené.");
    } catch {
      toast.error(t("advisorReview.error" as any) || "Hodnotenie sa nepodarilo.");
    } finally {
      setAnalyzing(false);
    }
  }, [userId, userUuid, analyzing, loadLatest, t]);

  return (
    <section className={SESSION_CARD} style={SESSION_CARD_STYLE}>
      <header className={[PANEL_PAD, PANEL_SECTION_HEAD].join(" ")}>
        <div className="min-w-0">
          <div className={PANEL_SECTION_TITLE}>{t("advisorReview.title" as any)}</div>
          <div className={PANEL_SECTION_SUBTITLE}>
            {createdAt
              ? `${t("advisorReview.updatedAt" as any)} ${formatDateTime(createdAt)}`
              : t("advisorReview.subtitle" as any)}
          </div>
        </div>
      </header>

      <div className={[PANEL_PAD, PANEL_INNER_STACK].join(" ")}>
        <AiUsageWarningBanner forceShow={quotaExceeded} className="mb-2" />

        {loading ? (
          <div className="flex justify-center py-4">
            <LoadingSpinner size="button" />
          </div>
        ) : !review ? (
          <div className={PANEL_PREVIEW}>{t("advisorReview.empty" as any)}</div>
        ) : (
          <div className="flex flex-col gap-3">
            {review.health_warning && (
              <div
                className="rounded-lg border px-3 py-2 text-sm"
                style={{
                  backgroundColor: `${appColors.statusError}1A`,
                  borderColor: `${appColors.statusError}33`,
                  color: appColors.statusError,
                }}
              >
                ⚠️ {review.health_warning}
              </div>
            )}

            {review.headline && (
              <div className="text-sm font-semibold">{review.headline}</div>
            )}

            {review.last_week && (
              <div className="flex flex-col gap-1.5">
                <SubTitle>{t("advisorReview.lastWeek" as any)}</SubTitle>
                {review.last_week.assessment && (
                  <div className="text-sm opacity-90 leading-snug">
                    {review.last_week.assessment}
                  </div>
                )}
                {(review.last_week.went_well?.length ?? 0) > 0 && (
                  <>
                    <div className="text-xs opacity-60 mt-1">
                      {t("advisorReview.wentWell" as any)}
                    </div>
                    <BulletList items={review.last_week.went_well} />
                  </>
                )}
                {(review.last_week.to_improve?.length ?? 0) > 0 && (
                  <>
                    <div className="text-xs opacity-60 mt-1">
                      {t("advisorReview.toImprove" as any)}
                    </div>
                    <BulletList items={review.last_week.to_improve} />
                  </>
                )}
              </div>
            )}

            {(review.upcoming_check?.length ?? 0) > 0 && (
              <div className="flex flex-col gap-1.5">
                <SubTitle>{t("advisorReview.upcomingCheck" as any)}</SubTitle>
                <BulletList items={review.upcoming_check} />
              </div>
            )}

            {review.next_week_guidance && (
              <div className="flex flex-col gap-1.5">
                <SubTitle>{t("advisorReview.nextWeek" as any)}</SubTitle>
                {review.next_week_guidance.summary && (
                  <div className="text-sm opacity-90 leading-snug">
                    {review.next_week_guidance.summary}
                  </div>
                )}
                <BulletList items={review.next_week_guidance.suggested_structure} />
              </div>
            )}
          </div>
        )}

        <Button
          size="sm"
          variant="primary"
          onClick={handleAnalyze}
          disabled={analyzing || !userId}
          className="w-full mt-2"
        >
          {analyzing ? <LoadingSpinner size="button" /> : t("advisorReview.analyzeBtn" as any)}
        </Button>
        {analyzing && (
          <div className="text-[10px] text-center opacity-60 italic">
            {t("advisorReview.analyzing" as any)}
          </div>
        )}
      </div>
      <div className={ACCORDION_FOOTER_BAR_MUTED} />
    </section>
  );
}