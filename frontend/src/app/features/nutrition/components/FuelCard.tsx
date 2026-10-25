"use client";

import { useState } from "react";
import {
  Beef,
  CakeSlice,
  CupSoda,
  Flag,
  Moon,
  Sandwich,
  Scale,
  Sunrise,
  Trophy,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import Button from "@/app/shared/ui/components/Button";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { CARD, SURFACE_CARD_STYLE } from "@/app/shared/ui/tokens";
import { fmt, useT, type TKey } from "@/app/shared/i18n/useT";
import { addDaysIso, todayLocalISO } from "@/app/shared/utils/time";
import { Pill, SportTile, WidgetLoading } from "@/app/shared/ui/widget/WidgetParts";
import { useNutritionFuel } from "@/app/shared/components/dataProviders/NutritionDataProvider";
import type { FuelTip } from "@/app/features/nutrition/types/nutrition";
import { fuelTipText, loadTone, visibleTips } from "@/app/features/nutrition/utils/fuel";

const TIP_ICON: Record<FuelTip["kind"], LucideIcon> = {
  rest: Utensils,
  easy: Utensils,
  pre: Sandwich,
  during: CupSoda,
  post: Beef,
  evening_before: Moon,
  loading: CakeSlice,
  race_breakfast: Sunrise,
  race_during: CupSoda,
  race_short: CupSoda,
  race_after: Flag,
  no_deficit: Scale,
  soft_deficit: Scale,
};

/**
 * Palivo na dnes a ďalšie 2 dni: záťaž dňa, tréningy, pretek a čo jesť
 * pred, počas a po. Funguje aj bez zapisovania jedla – stačí plán.
 */
export default function FuelCard({ locale }: { locale: string }) {
  const t = useT();
  const fuel = useNutritionFuel();
  const [idx, setIdx] = useState(0);
  const today = todayLocalISO();
  const data = fuel.data;

  if (!data) {
    return (
      <section className={[CARD, "p-4 sm:p-5"].join(" ")} style={SURFACE_CARD_STYLE}>
        {fuel.error ? (
          <p className="text-sm" style={{ color: appColors.statusError }}>
            {t("nutrition.errors.request_failed")}
          </p>
        ) : (
          <WidgetLoading />
        )}
      </section>
    );
  }
  if (!data.profile || !data.days.length) return null;

  const day = data.days[Math.min(idx, data.days.length - 1)];
  const label = (iso: string) =>
    iso === today
      ? t("nutrition.day.today")
      : iso === addDaysIso(today, 1)
        ? t("nutrition.day.tomorrow")
        : new Date(`${iso}T00:00:00`).toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "numeric" });
  const sessions = day.sessions.filter((s) => !s.event);
  const tips = visibleTips(day.tips, data.mode);

  return (
    <section className={[CARD, "p-4 sm:p-5 flex flex-col gap-3"].join(" ")} style={SURFACE_CARD_STYLE}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold" style={{ color: appColors.textPrimary }}>
          {t("nutrition.fuel.title")}
        </h3>
      </div>

      <div className="flex gap-2">
        {data.days.map((d, i) => (
          <Button
            key={d.date}
            type="button"
            size="xs"
            variant="prefs"
            active={i === idx}
            onClick={() => setIdx(i)}
            className="flex-1"
          >
            {label(d.date)}
            {d.race ? " 🏆" : ""}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {day.day_load ? <Pill tone={loadTone(day.day_load)} label={t(`nutrition.load.${day.day_load}` as TKey)} /> : null}
        {day.race ? (
          <Pill
            tone="info"
            icon={Trophy}
            label={
              day.race.kind === "race"
                ? day.race.name || t("nutrition.fuel.raceUnnamed")
                : fmt(t("nutrition.fuel.raceIn"), { n: day.race.days_to, name: day.race.name || t("nutrition.fuel.raceUnnamed") })
            }
          />
        ) : null}
      </div>

      {sessions.length ? (
        <ul className="flex flex-col gap-1.5">
          {sessions.map((s, i) => (
            <li key={`${s.source}-${i}`} className="flex items-center gap-2 text-sm">
              <SportTile sport={s.sport} />
              <span className="flex-1 min-w-0 truncate" style={{ color: appColors.textSecondary }}>
                {s.title || t(`nutrition.exercise.source.${s.source}` as TKey)}
              </span>
              <span className="text-xs tabular-nums shrink-0" style={{ color: appColors.textMuted }}>
                {s.minutes} min
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs" style={{ color: appColors.textMuted }}>
          {t("nutrition.fuel.noSessions")}
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {tips.map((tip, i) => {
          const Icon = TIP_ICON[tip.kind] ?? Utensils;
          return (
            <li key={`${tip.kind}-${i}`} className="flex items-start gap-2">
              <span
                className="inline-flex items-center justify-center w-6 h-6 rounded-md shrink-0 mt-px"
                style={{ background: appColors.surfaceCardBorder }}
              >
                <Icon size={13} color={appColors.textSecondary} />
              </span>
              <span className="text-sm leading-snug" style={{ color: appColors.textSecondary }}>
                {fuelTipText(t, tip, locale, data.mode)}
              </span>
            </li>
          );
        })}
      </ul>

      <p className="text-[11px] leading-relaxed" style={{ color: appColors.textMuted }}>
        {t("nutrition.fuel.footer")}
      </p>
    </section>
  );
}
