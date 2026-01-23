// src/features/billing/components/BillingHistory.tsx
"use client";

import type { AppUserSubscription } from "@/app/features/billing/types/billing";
import { appColors } from "@/app/shared/theme/app_colors";
import { PANEL_LIST, PANEL_LIST_ITEM } from "@/app/shared/ui/tokens/panels";

type BillingHistoryProps = {
  history: AppUserSubscription[];
};

export default function BillingHistory({ history }: BillingHistoryProps) {
  if (history.length === 0) {
    return <p style={{ color: appColors.textMuted }} className="text-xs">Zatiaľ žiadne záznamy o predplatnom.</p>;
  }

  return (
    <div className={PANEL_LIST}>
      {history.map((s) => (
        <div
          key={s.id}
          className={PANEL_LIST_ITEM}
          style={{
            background: appColors.surfaceCard,
            borderColor: appColors.surfaceCardBorder,
            color: appColors.textPrimary,
          }}
        >
          <div>
            <div className="font-semibold uppercase">
              {String(s.tier_code || "").toUpperCase()} • {String(s.status || "").toUpperCase()}
            </div>
            <div style={{ color: appColors.textMuted }} className="text-xs">
              {s.current_period_start?.slice(0, 10)} → {s.current_period_end?.slice(0, 10)}
            </div>
          </div>

          <div style={{ color: appColors.textMuted }} className="text-xs">
            {s.created_at?.slice(0, 10)}
          </div>
        </div>
      ))}
    </div>
  );
}