"use client";

import { useState, type ReactNode } from "react";
import { Apple, ChevronLeft, ChevronRight, Dumbbell, Plus, Settings2 } from "lucide-react";
import Button from "@/app/shared/ui/components/Button";
import { useCachedResource } from "@/app/shared/components/dataProviders/useCachedResource";
import { nutritionDayKey } from "@/app/shared/components/dataProviders/NutritionDataProvider";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { CARD, SURFACE_CARD_STYLE } from "@/app/shared/ui/tokens";
import { fmt, useT, type TKey } from "@/app/shared/i18n/useT";
import { addDaysIso, todayLocalISO } from "@/app/shared/utils/time";
import { Hero, IconTile, Pill, ProgressRow, WidgetLoading } from "@/app/shared/ui/widget/WidgetParts";
import { apiGetNutritionDay } from "@/app/features/nutrition/api/nutrition";
import { MEALS, type FoodEntry, type Meal, type NutritionDay } from "@/app/features/nutrition/types/nutrition";
import { MACRO_COLOR, MACRO_KEYS, fmtInt, sumMacros } from "@/app/features/nutrition/utils/nutrition";
import AddFoodModal from "@/app/features/nutrition/components/AddFoodModal";
import EntryEditModal from "@/app/features/nutrition/components/EntryEditModal";
import NutritionWeekCard from "@/app/features/nutrition/components/NutritionWeekCard";
import NutritionWeightCard from "@/app/features/nutrition/components/NutritionWeightCard";

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={[CARD, "p-4 sm:p-5", className].join(" ")} style={SURFACE_CARD_STYLE}>
      {children}
    </section>
  );
}

/**
 * Denný prehľad výživy: cieľ vs. zjedené, tréningy dňa (z nich je cieľ)
 * a zápisy podľa časti dňa. readOnly = tréner prezerá zverenca.
 */
export default function NutritionDayView({
  userId,
  locale,
  readOnly,
  onEditProfile,
}: {
  userId: number;
  locale: string;
  readOnly: boolean;
  onEditProfile: () => void;
}) {
  const t = useT();
  const today = todayLocalISO();
  const [date, setDate] = useState(today);
  const [adding, setAdding] = useState<{ meal?: Meal } | null>(null);
  const [editing, setEditing] = useState<FoodEntry | null>(null);
  const [showCalc, setShowCalc] = useState(false);

  const res = useCachedResource<NutritionDay>({
    key: nutritionDayKey(userId, date),
    fetcher: () => apiGetNutritionDay(userId, date),
    eager: true,
  });
  const day = res.data;

  const dateLabel =
    date === today
      ? t("nutrition.day.today")
      : date === addDaysIso(today, -1)
        ? t("nutrition.day.yesterday")
        : date === addDaysIso(today, 1)
          ? t("nutrition.day.tomorrow")
          : new Date(`${date}T00:00:00`).toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "numeric" });

  // zmena zápisu obnoví deň aj týždeň (týždeň je samostatný zdroj)
  const [changes, setChanges] = useState(0);
  const refresh = () => {
    void res.refresh();
    setChanges((c) => c + 1);
  };

  const header = (
    <div className="flex items-center justify-between gap-2">
      <Button circle size="sm" variant="ghost" aria-label={t("nutrition.day.prev")} onClick={() => setDate(addDaysIso(date, -1))}>
        <ChevronLeft size={16} />
      </Button>
      <button
        type="button"
        className="text-sm font-semibold"
        style={{ color: appColors.textPrimary }}
        onClick={() => setDate(today)}
      >
        {dateLabel}
      </button>
      <Button circle size="sm" variant="ghost" aria-label={t("nutrition.day.next")} onClick={() => setDate(addDaysIso(date, 1))}>
        <ChevronRight size={16} />
      </Button>
    </div>
  );

  if (!day) {
    return (
      <div className="flex flex-col gap-3 mt-4">
        {header}
        {res.error ? (
          <Card>
            <p className="text-sm" style={{ color: appColors.statusError }}>
              {t("nutrition.errors.request_failed")}
            </p>
          </Card>
        ) : (
          <WidgetLoading />
        )}
      </div>
    );
  }

  const targets = day.targets;
  const eaten = day.eaten ?? { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
  const entries = day.entries ?? [];
  const b = day.breakdown;
  const exercise = day.exercise ?? [];
  const left = targets ? targets.kcal - eaten.kcal : 0;
  // „pod BMR“ a „max. tempo chudnutia“ treba userovi povedať, ostatné sú len info
  const notes = (b?.limits ?? []).filter((l) => l !== "carbs_reduced");

  const byMeal = (m: Meal) => entries.filter((e) => e.meal === m);

  return (
    <div className="flex flex-col gap-3 mt-4 pb-12">
      {header}

      {/* súhrn dňa */}
      <Card className="flex flex-col gap-3">
        {targets ? (
          <>
            <Hero
              icon={<IconTile icon={Apple} color={MACRO_COLOR.kcal} />}
              value={fmtInt(eaten.kcal, locale)}
              unit={`/ ${fmtInt(targets.kcal, locale)} kcal`}
              sub={b ? t(`nutrition.load.${b.day_load}` as TKey) : undefined}
              right={
                <Pill
                  tone={left >= 0 ? "good" : "warn"}
                  label={
                    left >= 0
                      ? fmt(t("nutrition.widget.left"), { n: fmtInt(left, locale) })
                      : fmt(t("nutrition.widget.over"), { n: fmtInt(-left, locale) })
                  }
                />
              }
            />
            <div className="flex flex-col gap-2">
              {MACRO_KEYS.map((k) => (
                <ProgressRow
                  key={k}
                  label={t(`nutrition.macros.${k}` as TKey)}
                  done={eaten[k]}
                  total={targets[k]}
                  color={MACRO_COLOR[k]}
                  value={`${fmtInt(eaten[k], locale)} / ${fmtInt(targets[k], locale)} g`}
                />
              ))}
            </div>
            {notes.map((l) => (
              <p key={l} className="text-xs" style={{ color: appColors.statusWarning }}>
                {t(`nutrition.limits.${l}` as TKey)}
              </p>
            ))}
            {b ? (
              <div>
                <button
                  type="button"
                  className="text-xs underline-offset-2 hover:underline"
                  style={{ color: appColors.textSecondary }}
                  onClick={() => setShowCalc((v) => !v)}
                >
                  {showCalc ? t("nutrition.calc.hide") : t("nutrition.calc.show")}
                </button>
                {showCalc ? (
                  <ul className="mt-2 text-xs flex flex-col gap-1 tabular-nums" style={{ color: appColors.textSecondary }}>
                    <li>
                      {fmt(t(b.bmr_source === "manual" ? "nutrition.calc.bmrManual" : "nutrition.calc.bmr"), {
                        n: fmtInt(b.bmr, locale),
                      })}
                    </li>
                    <li>{fmt(t("nutrition.calc.neat"), { f: b.neat_factor.toLocaleString(locale) })}</li>
                    <li>
                      {fmt(t("nutrition.calc.exercise"), {
                        n: fmtInt(b.exercise_kcal, locale),
                        c: fmtInt(b.exercise_counted_kcal, locale),
                      })}
                    </li>
                    <li>{fmt(t("nutrition.calc.tdee"), { n: fmtInt(b.tdee, locale) })}</li>
                    <li>
                      {fmt(t(`nutrition.calc.goal.${b.goal}` as TKey), {
                        p: fmtInt(b.goal_rate_pct, locale),
                      })}
                    </li>
                    <li>
                      {fmt(t("nutrition.calc.macros"), {
                        p: b.protein_g_per_kg.toLocaleString(locale),
                        c: b.carbs_g_per_kg.toLocaleString(locale),
                        w: b.weight_kg.toLocaleString(locale),
                      })}
                    </li>
                  </ul>
                ) : null}
              </div>
            ) : null}
          </>
        ) : (
          <p className="text-sm" style={{ color: appColors.statusWarning }}>
            {t("nutrition.widget.missingBody")}
          </p>
        )}
      </Card>

      {/* tréningy dňa – z nich je cieľ */}
      {exercise.length ? (
        <Card className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold" style={{ color: appColors.textPrimary }}>
            {t("nutrition.exercise.title")}
          </h3>
          {exercise.map((ex, i) => (
            <div key={`${ex.source}-${ex.id ?? i}`} className="flex items-center gap-2 text-sm">
              <Dumbbell size={14} style={{ color: appColors.textMuted }} />
              <span className="flex-1 min-w-0 truncate" style={{ color: appColors.textSecondary }}>
                {ex.title || t(`nutrition.exercise.source.${ex.source}` as TKey)}
                {ex.source === "plan" || ex.source === "external" ? ` · ${t("nutrition.exercise.planned")}` : ""}
              </span>
              <span className="text-xs tabular-nums shrink-0" style={{ color: appColors.textMuted }}>
                {ex.minutes} min · {ex.estimated ? "≈ " : ""}
                {fmtInt(ex.kcal, locale)} kcal
              </span>
            </div>
          ))}
        </Card>
      ) : null}

      {/* jedlá */}
      {MEALS.map((m) => {
        const list = byMeal(m);
        const sum = sumMacros(list);
        return (
          <Card key={m} className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold" style={{ color: appColors.textPrimary }}>
                {t(`nutrition.meals.${m}` as TKey)}
              </h3>
              <div className="flex items-center gap-2">
                {list.length ? (
                  <span className="text-xs tabular-nums" style={{ color: appColors.textMuted }}>
                    {fmtInt(sum.kcal, locale)} kcal
                  </span>
                ) : null}
                {!readOnly ? (
                  <Button
                    circle
                    size="xs"
                    variant="ghost"
                    aria-label={t("nutrition.add.title")}
                    onClick={() => setAdding({ meal: m })}
                  >
                    <Plus size={14} />
                  </Button>
                ) : null}
              </div>
            </div>
            {list.length ? (
              <ul className="flex flex-col divide-y" style={{ borderColor: appColors.divider }}>
                {list.map((e) => (
                  <li key={e.id} style={{ borderColor: appColors.divider }}>
                    <button
                      type="button"
                      disabled={readOnly}
                      onClick={() => setEditing(e)}
                      className="w-full flex items-center gap-2 py-2 text-left"
                    >
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm truncate" style={{ color: appColors.textPrimary }}>
                          {e.name}
                        </span>
                        <span className="block text-[11px] tabular-nums" style={{ color: appColors.textMuted }}>
                          {e.grams ? `${fmtInt(e.grams, locale)} g · ` : ""}
                          {t("nutrition.macrosShort.protein_g")} {fmtInt(e.protein_g, locale)} ·{" "}
                          {t("nutrition.macrosShort.carbs_g")} {fmtInt(e.carbs_g, locale)} ·{" "}
                          {t("nutrition.macrosShort.fat_g")} {fmtInt(e.fat_g, locale)}
                        </span>
                      </span>
                      <span className="text-sm tabular-nums shrink-0" style={{ color: appColors.textSecondary }}>
                        {fmtInt(e.kcal, locale)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs" style={{ color: appColors.textMuted }}>
                {t("nutrition.meals.empty")}
              </p>
            )}
          </Card>
        );
      })}

      {!readOnly ? (
        <div className="flex flex-col items-center gap-2 pt-1">
          <Button leftIcon={<Plus size={16} />} onClick={() => setAdding({})}>
            {t("nutrition.add.title")}
          </Button>
          <Button size="sm" variant="ghost" leftIcon={<Settings2 size={14} />} onClick={onEditProfile}>
            {t("nutrition.setup.editLink")}
          </Button>
        </div>
      ) : null}

      <NutritionWeekCard userId={userId} locale={locale} version={changes} />
      {day.profile ? <NutritionWeightCard goal={day.profile.goal} locale={locale} /> : null}

      {adding ? (
        <AddFoodModal
          userId={userId}
          date={date}
          initialMeal={adding.meal}
          locale={locale}
          onClose={() => setAdding(null)}
          onSaved={refresh}
        />
      ) : null}
      {editing ? (
        <EntryEditModal
          userId={userId}
          entry={editing}
          locale={locale}
          onClose={() => setEditing(null)}
          onSaved={refresh}
        />
      ) : null}
    </div>
  );
}
