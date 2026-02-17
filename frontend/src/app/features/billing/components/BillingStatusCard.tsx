// src/features/billing/components/BillingStatusCard.tsx
"use client";

import React from "react";
import { useT } from "@/app/shared/i18n/useT";
import type { AppSubscriptionStatus } from "@/app/features/billing/types/billing";

type PlannedChange = {
  kind: "cancel" | "downgrade" | "upgrade";
  to_tier_code: string | null;
  effective_from: string | null;
} | null;

type Props = {
  status: AppSubscriptionStatus | null;
  activeTierCode: string;
  plannedChange: PlannedChange;
  loadingStatus: boolean;
  loadingAny: boolean;
  error: string | null;
  onCancelPlannedChange: () => void;
};

export default function BillingStatusCard({
  status,
  activeTierCode,
  plannedChange,
  loadingStatus,
  loadingAny,
  error,
  onCancelPlannedChange,
}: Props) {
  const t = useT();

  if (loadingStatus) {
    return (
      <div className="flex justify-center p-6 bg-base-100/50 rounded-xl border border-base-content/10">
        <span className="loading loading-spinner text-primary"></span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error text-sm rounded-xl">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="stroke-current shrink-0 h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span>{error}</span>
      </div>
    );
  }

  // Ak nemáme objekt z DB, usudzujeme, že sme vo "free" bez predplatného
  const subStatus = status?.active_subscription?.status || "none";
  const currentEnd = status?.active_subscription?.current_period_end;
  const isCanceled = status?.active_subscription?.cancel_at_period_end;

  // Rýchle preklady z tvojho sk.ts
  const tierPrefix = t("billing.status.tierPrefix") || "Aktuálny plán";
  const previewLabel = t("billing.planned.previewLabel") || "Plánovaná zmena";

  return (
    <div className="bg-base-100 rounded-xl border border-base-content/10 p-5 space-y-4 shadow-sm">
      <div className="flex flex-wrap gap-4 items-start justify-between">
        <div>
          <div className="text-sm font-medium opacity-70 mb-1">
            {tierPrefix}
          </div>
          <div className="text-2xl font-bold text-primary flex items-center gap-2">
            {activeTierCode.toUpperCase()}
            {subStatus === "active" && !isCanceled && (
              <span className="badge badge-success badge-sm">Active</span>
            )}
            {subStatus === "active" && isCanceled && (
              <span className="badge badge-warning badge-sm">Canceling</span>
            )}
          </div>
        </div>

        {/* Quota bar */}
        <div className="min-w-[150px] flex-1 max-w-[300px]">
          <div className="text-sm font-medium opacity-70 mb-1 flex justify-between">
            <span>{t("billing.usage.title")}</span>
            {status?.ai_quota?.monthly_limit_tokens ? (
              <span>
                {Math.round(
                  ((status.ai_quota.used_tokens_this_month ?? 0) /
                    (status.ai_quota.monthly_limit_tokens ?? 1)) *
                    100,
                )}
                %
              </span>
            ) : null}
          </div>

          <progress
            className="progress progress-primary w-full"
            value={status?.ai_quota?.used_tokens_this_month ?? 0}
            max={status?.ai_quota?.monthly_limit_tokens ?? 100}
          />

          <div className="text-xs opacity-60 mt-1">
            {(status?.ai_quota?.used_tokens_this_month ?? 0).toLocaleString()}{" "}
            {t("billing.usage.tokensUnit")} /{" "}
            {status?.ai_quota?.monthly_limit_tokens
              ? status.ai_quota.monthly_limit_tokens.toLocaleString()
              : t("billing.usage.noLimitDefined")}
          </div>
        </div>
      </div>

      {(currentEnd || plannedChange) && (
        <div className="pt-3 border-t border-base-content/10 text-sm space-y-2">
          {currentEnd && (
            <div className="flex justify-between items-center">
              <span className="opacity-70">Obdobie končí:</span>
              <span className="font-medium">
                {new Date(currentEnd).toLocaleDateString()}
              </span>
            </div>
          )}

          {plannedChange && (
            <div className="flex flex-col gap-2 p-3 bg-warning/10 rounded-lg border border-warning/20">
              <div className="flex justify-between items-center">
                <span className="text-warning font-semibold">
                  ⚠️ {previewLabel} (
                  {t(`billing.planned.kinds.${plannedChange.kind}`)}):
                </span>
                <span className="font-bold text-base-content">
                  {plannedChange.to_tier_code?.toUpperCase() || "FREE"}
                </span>
              </div>
              {plannedChange.effective_from && (
                <div className="text-xs opacity-80">
                  Zmena nastane:{" "}
                  {new Date(plannedChange.effective_from).toLocaleDateString()}
                </div>
              )}

              {/* Tlačidlo na zrušenie naplánovanej zmeny */}
              <div className="mt-2 flex justify-end">
                <button
                  className="btn btn-sm btn-outline btn-warning"
                  disabled={loadingAny}
                  onClick={onCancelPlannedChange}
                >
                  {loadingAny ? (
                    <span className="loading loading-spinner loading-xs"></span>
                  ) : null}
                  Zrušiť zmenu
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
