// src/features/billing/components/BillingStatusCard.tsx
"use client";

import Button from "@/app/shared/ui/components/Button";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import BillingUsageBar from "./BillingUsageBar";
import { useT } from "@/app/shared/i18n/useT";

import type {
  BillingStatusCardProps,
} from "@/app/features/billing/types/billing";

export default function BillingStatusCard({
  status,
  activeTierCode,
  plannedChange,
  loadingStatus,
  loadingAny,
  error,
  onCancelPlannedChange,
}: BillingStatusCardProps) {
  const t = useT();
  const activeSub = status?.active_subscription ?? null;

  const hasPlannedChange =
    !!plannedChange &&
    !!activeSub &&
    !!activeSub.current_period_end &&
    activeSub.cancel_at_period_end;

  const quota = (status as any)?.ai_quota;
  const limitTokens = quota?.monthly_limit_tokens ?? null;
  const usedTokens = quota?.used_tokens_this_month ?? null;
  const resetAt = quota?.reset_at ?? null;

  return (
    <section className="rounded-xl border border-white/10 bg-black/40 p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">{t("billing.status.cardTitle")}</h2>
          <p className="text-xs opacity-70">
            {t("billing.status.cardSubtitle")}
          </p>
        </div>
        {loadingStatus && <LoadingSpinner size="button" />}
      </div>

      {error && (
        <p className="mt-2 text-xs text-red-400 line-clamp-2">{error}</p>
      )}

      <div className="mt-3 text-sm space-y-1">
        <div>
          <span className="opacity-70">{t("billing.status.currentTierLabel")}: </span>
          <span className="font-semibold uppercase">
            {activeTierCode || "free"}
          </span>
        </div>

        {activeSub ? (
          <>
            <div>
              <span className="opacity-70">{t("billing.status.label")}: </span>
              <span className="font-semibold">
                {activeSub.status}
                {activeSub.cancel_at_period_end && ` (${t("billing.status.cancelAtEnd")})`}
              </span>
            </div>
            <div className="text-xs opacity-75">
              {activeSub.current_period_start &&
                activeSub.current_period_end && (
                  <>
                    {t("billing.status.billingPeriod")}:{" "}
                    {activeSub.current_period_start.slice(0, 10)} →{" "}
                    {activeSub.current_period_end.slice(0, 10)}
                  </>
                )}
            </div>

            <BillingUsageBar
              limitTokens={limitTokens ?? undefined}
              usedTokens={usedTokens ?? undefined}
              resetAt={resetAt ?? undefined}
            />

            {hasPlannedChange && (
              <div className="mt-2 text-xs">
                <div className="text-amber-300">
                  {plannedChange!.kind === "cancel"
                    ? t("billing.planned.cancelTitle")
                    : t("billing.planned.downgradeTitle")}{" "}
                  {plannedChange!.to_tier_code && (
                    <>
                      {t("billing.planned.toTier")}{" "}
                      <span className="font-semibold uppercase">
                        {plannedChange!.to_tier_code}
                      </span>
                    </>
                  )}{" "}
                  {plannedChange!.effective_from && (
                    <>
                      {t("billing.planned.fromDate")}{" "}
                      <span className="font-mono">
                        {plannedChange!.effective_from.slice(0, 10)}
                      </span>
                    </>
                  )}
                  .
                </div>

                <div className="mt-1">
                  <Button
                    size="xs"
                    variant="secondary"
                    disabled={loadingAny}
                    onClick={onCancelPlannedChange}
                  >
                    {loadingAny ? (
                      <span className="inline-flex items-center gap-1">
                        <LoadingSpinner size="button" />
                        {t("billing.planned.keepingCurrent")}
                      </span>
                    ) : (
                      t("billing.planned.keepCurrentBtn")
                    )}
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="text-xs opacity-75">
            {t("billing.status.noActiveMember")}
          </p>
        )}
      </div>
    </section>
  );
}