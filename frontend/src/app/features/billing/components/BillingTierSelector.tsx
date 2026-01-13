"use client";

import Button from "@/app/shared/components/ui/Button";
import LoadingSpinner from "@/app/shared/components/ui/LoadingSpinner";
import type {
   AppSubscriptionTier,
   PlannedChange,
   BillingTierSelectorProps,
} from "@/app/features/billing/types/billing";

const TIER_ORDER: Record<string, number> = {
  free: 0,
  classic: 1,
  pro: 2,
};

function tierRank(code: string | null | undefined): number {
  if (!code) return 0;
  return TIER_ORDER[code] ?? 0;
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
      <p className="mt-3 text-sm opacity-70">
        Zatiaľ nemáš v DB nakonfigurované žiadne subscription tiers.
      </p>
    );
  }

  return (
    <div className="mt-4 grid gap-3 md:grid-cols-3">
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

        let buttonLabel = "Switch to this tier";
        if (isCurrent) {
          buttonLabel = "Current tier";
        } else if (tier.code === "free" && plannedChange?.kind === "cancel") {
          buttonLabel = plannedChange.effective_from
            ? `Cancel on ${plannedChange.effective_from.slice(0, 10)}`
            : "Cancel scheduled";
        } else if (isPlannedTarget) {
          buttonLabel = plannedChange?.effective_from
            ? `Downgrade on ${plannedChange.effective_from.slice(0, 10)}`
            : "Downgrade scheduled";
        } else if (tier.code === "free") {
          buttonLabel = "Schedule cancel";
        } else if (isDowngrade) {
          buttonLabel = "Schedule downgrade";
        } else if (isUpgrade) {
          buttonLabel = "Upgrade now";
        }

        const disabled =
          isBusy ||
          isCurrent ||
          isPlannedTarget ||
          (tier.code === "free" && plannedChange?.kind === "cancel");

        return (
          <div
            key={tier.id}
            className={`rounded-lg border px-3 py-3 text-sm bg-black/40 ${
              isCurrent
                ? "border-emerald-400/70"
                : isPlannedTarget ||
                  (tier.code === "free" && plannedChange?.kind === "cancel")
                ? "border-amber-400/70"
                : "border-white/10 opacity-90"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="font-semibold uppercase tracking-wide text-xs">
                  {tier.code}
                </div>
                <div className="text-xs opacity-70">{tier.name}</div>
              </div>
              {isCurrent && (
                <span className="text-[10px] rounded-full border border-emerald-400/70 px-2 py-0.5 text-emerald-300">
                  current
                </span>
              )}
              {!isCurrent &&
                (isPlannedTarget ||
                  (tier.code === "free" && plannedChange?.kind === "cancel")) && (
                  <span className="text-[10px] rounded-full border border-amber-400/70 px-2 py-0.5 text-amber-300">
                    scheduled
                  </span>
                )}
            </div>

            <div className="mt-2 text-sm">
              {priceEur === 0 ? (
                <span className="font-semibold">Free</span>
              ) : (
                <span className="font-semibold">
                  {priceEur.toFixed(2)} € / mesiac
                </span>
              )}
            </div>

            <div className="mt-1 text-[11px] opacity-70">
              AI limit:{" "}
              <span className="font-semibold">
                {tier.ai_monthly_tokens_limit.toLocaleString("sk-SK")} tokenov /
                mesiac
              </span>
            </div>

            {tier.description && (
              <p className="mt-1 text-[11px] opacity-80 line-clamp-3">
                {tier.description}
              </p>
            )}

            <div className="mt-3">
              <Button
                size="xs"
                variant={isCurrent ? "secondary" : "primary"}
                disabled={disabled}
                onClick={() => onSetTier(tier.code)}
              >
                {isBusy && !isCurrent ? (
                  <span className="inline-flex items-center gap-1">
                    <LoadingSpinner size="button" />
                    Switching…
                  </span>
                ) : (
                  buttonLabel
                )}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}