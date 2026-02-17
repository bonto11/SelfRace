// src/features/billing/components/BillingUsageBar.tsx
"use client";

import type { BillingUsageBarProps } from "@/app/features/billing/types/billing";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { useT } from "@/app/shared/i18n/useT";

function pickColor(pct: number) {
  if (pct >= 90) return appColors.statusError;
  if (pct >= 75) return appColors.statusWarning;
  return appColors.brandPrimary; // Zelená (natur.greenPrimary)
}

export default function BillingUsageBar({
  limitTokens,
  usedTokens,
  resetAt,
}: BillingUsageBarProps) {
  const t = useT();
  const limit = Math.max(0, limitTokens ?? 0);
  const used = Math.max(0, usedTokens ?? 0);
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;

  return (
    <div className="w-full">
      <div className="flex justify-between items-end mb-1.5">
        <span className="text-xs font-semibold uppercase tracking-wider opacity-80" style={{ color: appColors.textPrimary }}>
          {t("subscription.usage.title")}
        </span>

        {limit > 0 ? (
          <span className="text-xs font-mono" style={{ color: appColors.textMuted }}>
            {used.toLocaleString("sk-SK")} / {limit.toLocaleString("sk-SK")}{" "}
            {t("subscription.usage.tokensUnit")}
          </span>
        ) : null}
      </div>

      {limit > 0 ? (
        <>
          <div
            className="h-2 w-full rounded-full overflow-hidden"
            style={{ background: appColors.buttonGhostBgHover }} // Jemne viditeľný track
          >
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${pct}%`,
                background: pickColor(pct),
              }}
            />
          </div>

          <div className="flex justify-between mt-1.5 text-[10px]" style={{ color: appColors.textMuted }}>
            <span>{t("subscription.usage.summary").replace("{{pct}}", String(pct))}</span>
            <span>{resetAt ? `${t("subscription.usage.reset")}: ${resetAt.slice(0, 10)}` : ""}</span>
          </div>
        </>
      ) : (
        <div className="text-[11px] mt-1" style={{ color: appColors.textMuted }}>
          {t("subscription.usage.noLimitDefined")}
        </div>
      )}
    </div>
  );
}