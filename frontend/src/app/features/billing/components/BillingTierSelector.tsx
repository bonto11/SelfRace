// src/features/billing/components/BillingTierSelector.tsx
"use client";

import Button from "@/app/shared/ui/components/Button";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import type { BillingTierSelectorProps } from "@/app/features/billing/types/billing";
import { appColors } from "@/app/shared/theme/app_colors";
import { PANEL_GRID_3, PANEL_BADGE } from "@/app/shared/ui/tokens";

const TIER_ORDER: Record<string, number> = { free: 0, classic: 1, pro: 2 };

function tierRank(code: string | null | undefined): number {
  if (!code) return 0;
  return TIER_ORDER[code] ?? 0;
}

function d10(s?: string | null) {
  return s ? s.slice(0, 10) : "";
}

export default function BillingTierSelector({
  tiers,
  activeTierCode,
  plannedChange,
  isBusy,
  onSetTier,
}: BillingTierSelectorProps) {
  const activeRank = tierRank(activeTierCode);

  if (tiers.length === 0) {
    return (
      <p className="text-sm" style={{ color: appColors.textMuted }}>
        Zatiaľ nemáš nakonfigurované žiadne programy.
      </p>
    );
  }

  return (
    <div className={PANEL_GRID_3}>
      {tiers.map((tier) => {
        const isCurrent = tier.code === activeTierCode;
        const priceEur = (tier.monthly_price_cents || 0) / 100;

        const rank = tierRank(tier.code);
        const isUpgrade = rank > activeRank;
        const isDowngrade = rank < activeRank;

        const isPlannedTarget =
          !!plannedChange &&
          plannedChange.to_tier_code === tier.code &&
          plannedChange.kind === "downgrade";

        const isPlannedCancel =
          tier.code === "free" && plannedChange?.kind === "cancel";

        let buttonLabel = "Zvoliť program";
        if (isCurrent) buttonLabel = "Aktuálny program";
        else if (isPlannedCancel)
          buttonLabel = plannedChange?.effective_from
            ? `Zruší sa ${d10(plannedChange.effective_from)}`
            : "Zrušenie je naplánované";
        else if (isPlannedTarget)
          buttonLabel = plannedChange?.effective_from
            ? `Zníži sa ${d10(plannedChange.effective_from)}`
            : "Zníženie je naplánované";
        else if (tier.code === "free") buttonLabel = "Naplánovať zrušenie";
        else if (isDowngrade) buttonLabel = "Naplánovať zníženie";
        else if (isUpgrade) buttonLabel = "Zvýšiť teraz";

        const disabled =
          isBusy || isCurrent || isPlannedTarget || isPlannedCancel;

        const borderColor = isCurrent
          ? appColors.statusSuccess
          : isPlannedTarget || isPlannedCancel
            ? appColors.statusWarning
            : appColors.surfaceCardBorder;

        const badge = isCurrent
          ? "aktuálny"
          : isPlannedTarget || isPlannedCancel
            ? "naplánované"
            : null;

        return (
          <div
            key={tier.id}
            className="rounded-lg border px-3 py-3"
            style={{
              background: appColors.surfaceCard,
              borderColor,
              color: appColors.textPrimary,
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="font-semibold uppercase tracking-wide text-xs">
                  {tier.code}
                </div>
                <div className="text-xs" style={{ color: appColors.textMuted }}>
                  {tier.name}
                </div>
              </div>

              {badge ? (
                <span
                  className={PANEL_BADGE}
                  style={{
                    borderColor,
                    color: isCurrent
                      ? appColors.statusSuccess
                      : appColors.statusWarning,
                    background: appColors.pillBg,
                  }}
                >
                  {badge}
                </span>
              ) : null}
            </div>

            <div
              className="text-sm font-semibold"
              style={{ color: appColors.textPrimary }}
            >
              {priceEur === 0 ? "Zdarma" : `${priceEur.toFixed(2)} € / mesiac`}
            </div>

            <div className="text-[11px]" style={{ color: appColors.textMuted }}>
              AI limit:{" "}
              <span
                className="font-semibold"
                style={{ color: appColors.textPrimary }}
              >
                {tier.ai_monthly_tokens_limit.toLocaleString("sk-SK")} tokenov /
                mesiac
              </span>
            </div>

            {tier.description ? (
              <p
                className="text-[11px] line-clamp-3"
                style={{ color: appColors.textSecondary }}
              >
                {tier.description}
              </p>
            ) : null}

            <Button
              size="xs"
              variant={isCurrent ? "secondary" : "primary"}
              disabled={disabled}
              onClick={() => onSetTier(tier.code)}
            >
              {isBusy && !isCurrent ? (
                <span className="inline-flex items-center gap-1">
                  <LoadingSpinner size="button" />
                  Ukladám…
                </span>
              ) : (
                buttonLabel
              )}
            </Button>
          </div>
        );
      })}
    </div>
  );
}
