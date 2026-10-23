"use client";

import { useEffect } from "react";
import { useCachedResource } from "@/app/shared/components/dataProviders/useCachedResource";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { CARD, SURFACE_CARD_STYLE } from "@/app/shared/ui/tokens";
import { fmt, useT, type TKey } from "@/app/shared/i18n/useT";
import { todayLocalISO } from "@/app/shared/utils/time";
import { DayBars, WidgetLoading } from "@/app/shared/ui/widget/WidgetParts";
import { apiNutritionWeek } from "@/app/features/nutrition/api/nutrition";
import type { NutritionWeek } from "@/app/features/nutrition/types/nutrition";
import { MACRO_COLOR, fmtInt } from "@/app/features/nutrition/utils/nutrition";

const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

const weekdayKey = (iso: string) => WEEKDAY_KEYS[new Date(`${iso}T00:00:00`).getDay()];

/**
 * Posledných 7 dní: zjedené kcal po dňoch (svetlý stĺpec za nimi = cieľ),
 * priemer kcal a bielkovín zo zapísaných dní a sacharidy v náročné dni.
 * Nezapísaný deň sa do priemeru neráta – nie je to „0 kcal“.
 */
export default function NutritionWeekCard({
  userId,
  locale,
  version = 0,
}: {
  userId: number;
  locale: string;
  /** zvýšenie = zápis sa zmenil, načítaj znova */
  version?: number;
}) {
  const t = useT();
  const today = todayLocalISO();
  const res = useCachedResource<NutritionWeek>({
    key: `nutrition:week:${userId}:${today}`,
    fetcher: () => apiNutritionWeek(userId),
    eager: true,
  });
  const week = res.data;
  const { refresh } = res;

  useEffect(() => {
    if (version > 0) void refresh();
  }, [version, refresh]);

  if (!week) {
    return (
      <section className={[CARD, "p-4 sm:p-5"].join(" ")} style={SURFACE_CARD_STYLE}>
        {res.error ? (
          <p className="text-sm" style={{ color: appColors.statusError }}>
            {t("nutrition.errors.request_failed")}
          </p>
        ) : (
          <WidgetLoading />
        )}
      </section>
    );
  }
  if (!week.profile) return null;

  const s = week.summary;
  const labels = week.days.map((d) => t(`common.weeksShort.${weekdayKey(d.date)}` as TKey));

  return (
    <section className={[CARD, "p-4 sm:p-5 flex flex-col gap-3"].join(" ")} style={SURFACE_CARD_STYLE}>
      <h3 className="text-sm font-semibold" style={{ color: appColors.textPrimary }}>
        {t("nutrition.week.title")}
      </h3>
      <DayBars
        values={week.days.map((d) => (d.logged ? d.eaten.kcal : 0))}
        ghost={week.days.map((d) => d.targets?.kcal ?? 0)}
        labels={labels}
        color={MACRO_COLOR.kcal}
      />
      {s.logged_days ? (
        <ul className="text-xs flex flex-col gap-1 tabular-nums" style={{ color: appColors.textSecondary }}>
          <li>
            {fmt(t("nutrition.week.kcal"), {
              n: fmtInt(s.avg_kcal, locale),
              t: fmtInt(s.avg_target_kcal, locale),
              p: s.kcal_pct ?? "—",
            })}
          </li>
          <li>
            {fmt(t("nutrition.week.protein"), {
              n: fmtInt(s.avg_protein_g, locale),
              t: fmtInt(s.avg_target_protein_g, locale),
              p: s.protein_pct ?? "—",
            })}
          </li>
          {(s.hard_days ?? []).map((d) => (
            <li key={d.date}>
              {fmt(t("nutrition.week.hardDay"), {
                d: t(`common.weeksShort.${weekdayKey(d.date)}` as TKey),
                n: fmtInt(d.carbs_g, locale),
                t: fmtInt(d.target_carbs_g, locale),
              })}
            </li>
          ))}
          <li style={{ color: appColors.textMuted }}>{fmt(t("nutrition.week.logged"), { n: s.logged_days })}</li>
        </ul>
      ) : (
        <p className="text-xs" style={{ color: appColors.textMuted }}>
          {t("nutrition.week.empty")}
        </p>
      )}
    </section>
  );
}
