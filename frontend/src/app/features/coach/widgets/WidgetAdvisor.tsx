"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck, Sparkles, UserRound } from "lucide-react";

import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import Button from "@/app/shared/ui/components/Button";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { toast } from "@/app/shared/ui/components/Toast";
import { useCoachData } from "@/app/shared/components/dataProviders/CoachDataProvider";
import { useEnsure } from "@/app/shared/components/dataProviders/useCachedResource";
import { useUserId } from "@/app/shared/hooks/useUserId";
import AiUsageWarningBanner from "@/app/features/billing/components/AiUsageWarningBanner";
import { apiGenerateAdvisorReview } from "@/app/features/coach/api/advisor_review";
import { enableAdvisorPlan } from "@/app/features/coach/utils/enableAdvisor";
import { coachInfo, firstText } from "@/app/features/coach/utils/coachInfo";
import { useT } from "@/app/shared/i18n/useT";
import { appLocale } from "@/app/shared/i18n/locale";
import { WK } from "@/app/shared/ui/tokens/widgets";
import {
  Caption,
  Headline,
  Highlight,
  WidgetEmpty,
  WidgetLoading,
} from "@/app/shared/ui/widget/WidgetParts";

const ADVISOR_HREF = "/coach/advisor/daily";

/**
 * AI poradca (advisor režim) – pre toho, kto si tréningy skladá sám.
 *
 * Bez plánu: jedno ťuknutie zapne advisor a založí prázdny plán.
 * S plánom: posledné hodnotenie týždňa (headline + pozitívum + riziko)
 * a „Skontroluj mi týždeň“ priamo vo widgete. Celé hodnotenie s návrhmi
 * a gombíkom „+ Pridať“ (napr. kardio) je v detaile.
 */
export default function WidgetAdvisor() {
  const t = useT();
  const router = useRouter();
  const { userId, trainerView } = useUserId();
  const { prefs, prefsLoaded, activePlanStatus, advisorReview, refresh } = useCoachData();
  useEnsure(activePlanStatus, advisorReview);

  const [busy, setBusy] = useState(false);
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  const isAdvisor = (prefs as any)?.coach_mode === "advisor";
  const hasActivePlan = !!activePlanStatus.data?.has_active;
  const ready = isAdvisor && hasActivePlan;
  const loading = !prefsLoaded || !activePlanStatus.loaded || (ready && !advisorReview.loaded);

  const review = advisorReview.data?.row?.review ?? null;
  const createdAt = advisorReview.data?.row?.created_at ?? null;
  const trainerActive = !!advisorReview.data?.trainerActive;

  const handleEnable = async () => {
    if (!userId || busy) return;
    setBusy(true);
    const res = await enableAdvisorPlan(userId, { hasActivePlan });
    if (res === "ok") {
      await refresh(true);
      router.push(ADVISOR_HREF);
    } else {
      toast.error(t(res === "coach_plan_active" ? "advisorWidget.coachPlanActive" : "advisorWidget.enableFailed"));
    }
    setBusy(false);
  };

  const handleReview = async () => {
    if (!userId || busy) return;
    setBusy(true);
    setQuotaExceeded(false);
    try {
      const out = await apiGenerateAdvisorReview(userId);
      if (!out.success) {
        if (out.error_code === "ai_quota_exceeded") setQuotaExceeded(true);
        toast.error(t("advisorReview.error" as any));
        return;
      }
      await advisorReview.refresh();
      toast.success(t("advisorReview.success" as any));
    } finally {
      setBusy(false);
    }
  };

  const plus = firstText(review?.last_week?.went_well);
  // zdravotné varovanie má prednosť pred bežným „zlepši“
  const minus = review?.health_warning || firstText(review?.last_week?.to_improve);
  const dateLabel = createdAt
    ? new Date(createdAt).toLocaleDateString(appLocale(), { day: "numeric", month: "short" })
    : null;

  const stop = (fn: () => void) => (e: any) => {
    e?.stopPropagation?.();
    fn();
  };

  return (
    <WidgetCard
      title={t("advisorWidget.title")}
      tooltip={coachInfo(t, "advisor")}
      accent="none"
      onOpen={ready ? () => router.push(ADVISOR_HREF) : undefined}
      interactive={ready}
      minH={160}
    >
      {loading ? (
        <WidgetLoading />
      ) : !ready ? (
        // tréner nemôže zverencovi spustiť plán – len informácia
        <WidgetEmpty icon={Sparkles} text={trainerView ? t("advisorWidget.noPlanTrainerView") : t("advisorWidget.intro")}>
          {!trainerView ? (
            <div>
              <Button size="sm" variant="primary" disabled={busy} onClick={stop(handleEnable)}>
                {busy ? <LoadingSpinner size="button" /> : t("advisorWidget.enable")}
              </Button>
            </div>
          ) : null}
        </WidgetEmpty>
      ) : trainerActive ? (
        <WidgetEmpty icon={UserRound} text={t("advisorWidget.trainerActive")} />
      ) : (
        <div className={WK.stack}>
          {/* banner len pri prekročenom limite – inak by free user videl stále červený pás */}
          {quotaExceeded ? <AiUsageWarningBanner forceShow /> : null}
          {review ? (
            <>
              {review.headline ? <Headline>{review.headline}</Headline> : null}
              {plus || minus ? (
                <div className="space-y-1.5">
                  {plus ? <Highlight tone="good" text={plus} /> : null}
                  {minus ? <Highlight tone="warn" text={minus} /> : null}
                </div>
              ) : null}
            </>
          ) : (
            <WidgetEmpty icon={ClipboardCheck} text={t("advisorWidget.noReview")} />
          )}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <Button size="xs" variant={review ? "secondary" : "primary"} disabled={busy} onClick={stop(handleReview)}>
              {busy ? <LoadingSpinner size="button" /> : t("advisorReview.analyzeBtn" as any)}
            </Button>
            {dateLabel ? <Caption>{`${t("advisorReview.updatedAt" as any)} ${dateLabel}`}</Caption> : null}
          </div>
        </div>
      )}
    </WidgetCard>
  );
}
