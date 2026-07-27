"use client";

import {
  daysAgoFromDate,
  isBestExpired,
  formatAgeLabel,
} from "@/app/features/bests/utils/bests";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { useT } from "@/app/shared/i18n/useT";

type PBAgeBadgeProps = {
  best: {
    days_ago?: number | null;
    is_expired?: boolean | null;
    achieved_at?: string | null;
  };
  children: React.ReactNode;
};

/**
 * Obalí PB kartu a zobrazí badge "X mes. · starý rekord" ak je best
 * expirovaný (nad PB_VALID_DAYS = 180, viď bests.ts). Jednotná logika
 * pre všetky športy — zmena/threshold sa mení na jednom mieste.
 */
export default function PBAgeBadge({ best, children }: PBAgeBadgeProps) {
  const t = useT();
  const daysAgo = best.days_ago ?? daysAgoFromDate(best.achieved_at);
  const expired = isBestExpired(best);
  const ageLabel = formatAgeLabel(daysAgo);

  return (
    <div className="relative">
      {expired && ageLabel && (
        <div
          className="absolute -top-2 right-2 z-10 rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap"
          style={{
            background: appColors.backgroundAlt,
            color: appColors.statusWarning,
            border: `1px solid ${appColors.statusWarning}`,
          }}
          title={
            t("PB.expiredTooltip" as any)
          }
        >
          {ageLabel} · {t("PB.old" as any)}
        </div>
      )}
      {children}
    </div>
  );
}