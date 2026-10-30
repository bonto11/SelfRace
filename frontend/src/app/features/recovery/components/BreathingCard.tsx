"use client";

import Link from "next/link";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { CARD, SURFACE_CARD_STYLE } from "@/app/shared/ui/tokens";
import { useT } from "@/app/shared/i18n/useT";
import { useFeature } from "@/app/shared/state/featureFlagsStore";
import { useUserId } from "@/app/shared/hooks/useUserId";

/** Odkaz na dychové cvičenie na stránke Regenerácia (nie počas prezerania zverenca). */
export default function BreathingCard() {
  const t = useT();
  const enabled = useFeature("recovery_extras");
  const { userId, ownUserId } = useUserId();
  if (!enabled || (ownUserId && userId !== ownUserId)) return null;

  return (
    <Link
      href="/recovery/breathing"
      className={`${CARD} mt-4 p-4 flex items-center gap-3`}
      style={SURFACE_CARD_STYLE}
    >
      <span className="text-2xl" aria-hidden>
        🌬️
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold" style={{ color: appColors.textPrimary }}>
          {t("breathing.cardTitle")}
        </span>
        <span className="block text-xs" style={{ color: appColors.textSecondary }}>
          {t("breathing.cardDesc")}
        </span>
      </span>
      <span className="text-sm font-semibold" style={{ color: appColors.brandPrimary }}>
        {t("breathing.cardBtn")} →
      </span>
    </Link>
  );
}
