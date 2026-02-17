// src/features/billing/components/BillingHistory.tsx
"use client";

import type { AppUserSubscription } from "@/app/features/billing/types/billing";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { PANEL_LIST, PANEL_LIST_ITEM } from "@/app/shared/ui/tokens";
import { useT } from "@/app/shared/i18n/useT";

type BillingHistoryProps = {
  history: AppUserSubscription[];
};

export default function BillingHistory({ history }: BillingHistoryProps) {
  const t = useT();

  if (history.length === 0) {
    return (
      <p style={{ color: appColors.textMuted }} className="text-xs">
        {t("billing.history.noRecords")}
      </p>
    );
  }

  const getTierColor = (code: string) => {
    switch (code.toLowerCase()) {
      case "family": return appColors.brandFamily;
      case "pro": return appColors.brandPro;
      case "classic": return appColors.brandClassic;
      default: return appColors.brandFree;
    }
  };

  return (
    <div className={PANEL_LIST}>
      {history.map((s) => {
        const tierColor = getTierColor(s.tier_code || "");
        
        return (
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
              <div className="font-semibold uppercase tracking-wider text-sm flex items-center gap-2">
                <span style={{ color: tierColor }}>
                  {String(s.tier_code || "").toUpperCase()}
                </span>
                <span className="opacity-40">•</span>
                <span className="opacity-80">
                  {String(s.status || "").toUpperCase()}
                </span>
              </div>
              <div style={{ color: appColors.textMuted }} className="text-[11px] mt-1">
                {s.current_period_start?.slice(0, 10)} →{" "}
                {s.current_period_end?.slice(0, 10)}
              </div>
            </div>

            <div style={{ color: appColors.textMuted }} className="text-xs text-right">
              {s.created_at?.slice(0, 10)}
            </div>
          </div>
        );
      })}
    </div>
  );
}