"use client";

import Link from "next/link";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { useT } from "@/app/shared/i18n/useT";
import { useAiUsageWarning } from "@/app/features/billing/hooks/useAiUsageWarning";

export default function AiUsageWarningBadge() {
  const t = useT();
  const { isFree, showWarning } = useAiUsageWarning();

  if (!showWarning) return null;

  const label = isFree
    ? t("billing.usageWarning.noSubscriptionTitle" as any) || "Nemáš aktívne predplatné"
    : t("billing.usageWarning.lowTokensTitle" as any) || "Dochádzajú ti AI kredity";

  return (
    <Link
      href="/subscription"
      aria-label={label}
      title={label}
      className="flex items-center justify-center rounded-full transition-transform hover:scale-105"
      style={{
        width: 28,
        height: 28,
        background: "rgba(239, 68, 68, 0.12)",
        border: `1px solid ${appColors.statusError}`,
        color: appColors.statusError,
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </Link>
  );
}