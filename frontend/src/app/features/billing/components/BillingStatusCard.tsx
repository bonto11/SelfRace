// src/features/billing/components/BillingStatusCard.tsx
"use client";

import Button from "@/app/shared/components/ui/Button";
import LoadingSpinner from "@/app/shared/components/ui/LoadingSpinner";
import BillingUsageBar from "./BillingUsageBar";

import type { BillingStatusCardProps } from "@/app/features/billing/types/billing";
import { appColors } from "@/app/shared/theme/app_colors";
import { PANEL } from "@/app/shared/ui/tokens/panels";
import { PANEL_CARD_HEAD, PANEL_CARD_TITLE, PANEL_CARD_SUBTITLE, PANEL_KV_STACK } from "@/app/shared/ui/tokens/panels";

export default function BillingStatusCard({
  status,
  activeTierCode,
  plannedChange,
  loadingStatus,
  loadingAny,
  error,
  onCancelPlannedChange,
}: BillingStatusCardProps) {
  const activeSub = status?.active_subscription ?? null;

  const hasPlannedChange =
    !!plannedChange &&
    !!activeSub &&
    !!activeSub.current_period_end &&
    !!activeSub.cancel_at_period_end;

  const quota = (status as any)?.ai_quota as
    | { monthly_limit_tokens?: number | null; used_tokens_this_month?: number | null; reset_at?: string | null }
    | undefined;

  const limitTokens = quota?.monthly_limit_tokens ?? null;
  const usedTokens = quota?.used_tokens_this_month ?? null;
  const resetAt = quota?.reset_at ?? null;

  const plannedLabel =
    plannedChange?.kind === "cancel"
      ? "Plánované zrušenie"
      : plannedChange?.kind === "downgrade"
      ? "Plánované zníženie"
      : plannedChange?.kind === "upgrade"
      ? "Plánované zvýšenie"
      : null;

  return (
    <section
      className={PANEL}
      style={{
        background: appColors.surfaceCard,
        borderColor: appColors.surfaceCardBorder,
        color: appColors.textPrimary,
      }}
    >
      <div className={PANEL_CARD_HEAD}>
        <div>
          <h2 className={PANEL_CARD_TITLE}>Stav predplatného</h2>
          <p className={PANEL_CARD_SUBTITLE} style={{ color: appColors.textMuted }}>
            Aktuálny program a AI limity.
          </p>
        </div>

        {loadingStatus && <LoadingSpinner size="button" />}
      </div>

      {error && (
        <p className="text-xs line-clamp-2" style={{ color: appColors.statusError }}>
          {error}
        </p>
      )}

      <div className={PANEL_KV_STACK}>
        <div>
          <span style={{ color: appColors.textMuted }}>Aktuálny program: </span>
          <span className="font-semibold uppercase">{activeTierCode || "free"}</span>
        </div>

        {activeSub ? (
          <>
            <div>
              <span style={{ color: appColors.textMuted }}>Stav: </span>
              <span className="font-semibold">
                {String(activeSub.status || "").toUpperCase()}
                {activeSub.cancel_at_period_end ? " (zruší sa na konci obdobia)" : ""}
              </span>
            </div>

            {activeSub.current_period_start && activeSub.current_period_end ? (
              <div className="text-xs" style={{ color: appColors.textMuted }}>
                Obdobie: {activeSub.current_period_start.slice(0, 10)} →{" "}
                {activeSub.current_period_end.slice(0, 10)}
              </div>
            ) : null}

            <BillingUsageBar
              limitTokens={limitTokens ?? undefined}
              usedTokens={usedTokens ?? undefined}
              resetAt={resetAt ?? undefined}
            />

            {hasPlannedChange && plannedLabel ? (
              <div className="text-xs">
                <div style={{ color: appColors.statusWarning }}>
                  {plannedLabel}
                  {plannedChange?.to_tier_code ? (
                    <>
                      {" "}
                      →{" "}
                      <span className="font-semibold uppercase">
                        {plannedChange.to_tier_code}
                      </span>
                    </>
                  ) : null}
                  {plannedChange?.effective_from ? (
                    <>
                      {" "}
                      od{" "}
                      <span className="font-mono">
                        {plannedChange.effective_from.slice(0, 10)}
                      </span>
                    </>
                  ) : null}
                  .
                </div>

                <Button
                  size="xs"
                  variant="secondary"
                  disabled={loadingAny}
                  onClick={onCancelPlannedChange}
                >
                  {loadingAny ? (
                    <span className="inline-flex items-center gap-1">
                      <LoadingSpinner size="button" />
                      Potvrdzujem…
                    </span>
                  ) : (
                    "Ponechať aktuálny program"
                  )}
                </Button>
              </div>
            ) : null}
          </>
        ) : (
          <p className="text-xs" style={{ color: appColors.textMuted }}>
            Nemáš aktívne platené členstvo. Používaš free program.
          </p>
        )}
      </div>
    </section>
  );
}