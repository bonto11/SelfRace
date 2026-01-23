// src/features/billing/components/BillingUsageBar.tsx
"use client";

import type { BillingUsageBarProps } from "@/app/features/billing/types/billing";
import { appColors } from "@/app/shared/theme/app_colors";
import {
  PANEL_BAR_CARD,
  PANEL_BAR_HEAD,
  PANEL_BAR_TRACK,
  PANEL_BAR_FILL,
  PANEL_BAR_FOOT,
} from "@/app/shared/ui/tokens";

function pickColor(pct: number) {
  if (pct >= 90) return appColors.statusError;
  if (pct >= 75) return appColors.statusWarning;
  return appColors.statusSuccess;
}

export default function BillingUsageBar({ limitTokens, usedTokens, resetAt }: BillingUsageBarProps) {
  const limit = Math.max(0, limitTokens ?? 0);
  const used = Math.max(0, usedTokens ?? 0);
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;

  return (
    <div
      className={PANEL_BAR_CARD}
      style={{
        background: appColors.surfaceCard,
        borderColor: appColors.surfaceCardBorder,
        color: appColors.textPrimary,
      }}
    >
      <div className={PANEL_BAR_HEAD}>
        <span className="font-semibold">Použitie AI tento mesiac</span>

        {limit > 0 ? (
          <span className="font-mono" style={{ color: appColors.textMuted }}>
            {used.toLocaleString("sk-SK")} / {limit.toLocaleString("sk-SK")} tokenov
          </span>
        ) : null}
      </div>

      {limit > 0 ? (
        <>
          <div className={PANEL_BAR_TRACK} style={{ background: appColors.buttonGhostBg }}>
            <div
              className={PANEL_BAR_FILL}
              style={{
                width: `${pct}%`,
                background: pickColor(pct),
              }}
            />
          </div>

          <div className={PANEL_BAR_FOOT} style={{ color: appColors.textMuted }}>
            <span>Využité ~{pct}% mesačného limitu.</span>
            <span>{resetAt ? `Reset: ${resetAt.slice(0, 10)}` : ""}</span>
          </div>
        </>
      ) : (
        <div className="text-[11px]" style={{ color: appColors.textMuted }}>
          Pre tento program nemám definovaný AI limit.
        </div>
      )}
    </div>
  );
}