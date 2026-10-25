"use client";

import { HeartPulse } from "lucide-react";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { CARD, SURFACE_CARD_STYLE } from "@/app/shared/ui/tokens";
import { fmt, useT, type TKey } from "@/app/shared/i18n/useT";
import { appLocale } from "@/app/shared/i18n/locale";
import type { NutritionWarnings as Warnings } from "@/app/features/nutrition/types/nutrition";

const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

/**
 * Varovania z posledných 7 dní (BE `_warnings`): dlhodobé podjedenie
 * (RED-S), málo sacharidov v náročné dni, rýchly pokles váhy.
 * PREČO žltá a nie červená: nie je to zlyhanie, je to rada – zahanbujúce
 * farby ľudí od zapisovania odháňajú.
 */
export default function NutritionWarnings({ warnings }: { warnings: Warnings | undefined }) {
  const t = useT();
  if (!warnings) return null;
  const { underfuel, low_carb_hard_days: lowCarb, fast_loss: fastLoss } = warnings;
  if (!underfuel && !lowCarb?.length && !fastLoss) return null;

  const days = (lowCarb ?? [])
    .map((d) => t(`common.weeksShort.${WEEKDAY_KEYS[new Date(`${d.date}T00:00:00`).getDay()]}` as TKey))
    .join(", ");

  return (
    <section className={[CARD, "p-4 sm:p-5 flex flex-col gap-2"].join(" ")} style={SURFACE_CARD_STYLE}>
      <div className="flex items-center gap-2">
        <HeartPulse size={16} color={appColors.statusWarning} />
        <h3 className="text-sm font-semibold" style={{ color: appColors.textPrimary }}>
          {t("nutrition.warnings.title")}
        </h3>
      </div>
      {underfuel ? (
        <p className="text-sm leading-relaxed" style={{ color: appColors.textSecondary }}>
          {fmt(t("nutrition.warnings.underfuel"), { p: underfuel.kcal_pct, n: underfuel.days })}
        </p>
      ) : null}
      {lowCarb?.length ? (
        <p className="text-sm leading-relaxed" style={{ color: appColors.textSecondary }}>
          {fmt(t("nutrition.warnings.lowCarb"), { d: days })}
        </p>
      ) : null}
      {fastLoss ? (
        <p className="text-sm leading-relaxed" style={{ color: appColors.textSecondary }}>
          {fmt(t("nutrition.warnings.fastLoss"), {
            p: fastLoss.pct_per_week.toLocaleString(appLocale()),
            kg: fastLoss.kg_per_week.toLocaleString(appLocale()),
          })}
        </p>
      ) : null}
      <p className="text-[11px] leading-relaxed" style={{ color: appColors.textMuted }}>
        {t("nutrition.warnings.help")}
      </p>
    </section>
  );
}
