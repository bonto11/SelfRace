"use client";

import Link from "next/link";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { useT } from "@/app/shared/i18n/useT";
import { useAiUsageWarning } from "@/app/features/billing/hooks/useAiUsageWarning";

export default function AiUsageWarningBanner({
  forceShow = false,
  className = "",
}: {
  forceShow?: boolean;
  className?: string;
}) {
  const t = useT();
  const { isFree, showWarning } = useAiUsageWarning();

  if (!showWarning && !forceShow) return null;

  // forceShow (napr. po ai_quota_exceeded z API) víťazí nad "isFree" rozlíšením
  // titulku len ak lokálny status ešte nevie, že je vyčerpaný — inak necháme
  // presnejší rozdiel medzi "žiadne predplatné" a "došli kredity".
  const title = isFree
    ? t("billing.usageWarning.noSubscriptionTitle" as any) || "Nemáš aktívne predplatné"
    : t("billing.usageWarning.lowTokensTitle" as any) || "Dochádzajú ti AI kredity";

  const desc = isFree
    ? t("billing.usageWarning.noSubscriptionDesc" as any) ||
      "Na využívanie AI funkcií (generovanie plánov, review tréningov) potrebuješ aktívne predplatné."
    : t("billing.usageWarning.lowTokensDesc" as any) ||
      "Tento mesiac ti čoskoro dôjde AI kvóta. Zváž upgrade predplatného.";

  return (
    <Link
      href="/subscription"
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-transform hover:scale-[1.01] ${className}`}
      style={{
        background: "rgba(239, 68, 68, 0.14)",
        borderColor: appColors.statusError,
      }}
    >
      <div
        className="flex items-center justify-center rounded-full shrink-0"
        style={{
          width: 34,
          height: 34,
          background: "rgba(239, 68, 68, 0.20)",
          color: appColors.statusError,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div className="min-w-0">
        <div className="text-sm font-bold" style={{ color: appColors.statusError }}>
          {title}
        </div>
        <div className="text-xs opacity-80 leading-relaxed" style={{ color: appColors.textSecondary }}>
          {desc}
        </div>
      </div>
    </Link>
  );
}