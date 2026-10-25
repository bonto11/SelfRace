"use client";

import { useState } from "react";
import { Plus, Sparkles } from "lucide-react";
import Button from "@/app/shared/ui/components/Button";
import { toast } from "@/app/shared/ui/components/Toast";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { CARD, SURFACE_CARD_STYLE } from "@/app/shared/ui/tokens";
import { fmt, useT, type TKey } from "@/app/shared/i18n/useT";
import { apiAddFoodLog, apiSuggestMeals } from "@/app/features/nutrition/api/nutrition";
import type { MealSuggestion, NutritionMode, SuggestedMeal } from "@/app/features/nutrition/types/nutrition";
import { fmtInt, nutritionErrorText } from "@/app/features/nutrition/utils/nutrition";

/**
 * AI návrh jedál na zvyšok dňa. AI vyberá jedlá (hlavne z toho, čo user
 * jedáva), gramy dorovná BE. Návrh sa drží na deň – nový je ďalšie AI volanie.
 */
export default function MealSuggestions({
  userId,
  date,
  suggestion,
  mode,
  locale,
  onChanged,
}: {
  userId: number;
  date: string;
  suggestion: MealSuggestion | null | undefined;
  mode: NutritionMode;
  locale: string;
  onChanged: () => void;
}) {
  const t = useT();
  const [busy, setBusy] = useState<string | null>(null);
  const [local, setLocal] = useState<MealSuggestion | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const data = local ?? suggestion ?? null;
  const simple = mode === "simple";

  const generate = async (force: boolean) => {
    setBusy("generate");
    try {
      const res = await apiSuggestMeals(userId, date, force);
      setLocal(res.suggestion);
      setAdded(new Set());
    } catch (e) {
      toast.error(nutritionErrorText(t, e));
    } finally {
      setBusy(null);
    }
  };

  const add = async (m: SuggestedMeal, key: string) => {
    setBusy(key);
    try {
      await apiAddFoodLog(userId, { date, meal: m.meal, source: "suggestion", items: m.items });
      setAdded((s) => new Set(s).add(key));
      toast.success(t("nutrition.suggest.added"));
      onChanged();
    } catch (e) {
      toast.error(nutritionErrorText(t, e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className={[CARD, "p-4 sm:p-5 flex flex-col gap-3"].join(" ")} style={SURFACE_CARD_STYLE}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold" style={{ color: appColors.textPrimary }}>
          {t("nutrition.suggest.title")}
        </h3>
        {data ? (
          <Button size="xs" variant="ghost" onClick={() => generate(true)} disabled={busy != null}>
            {busy === "generate" ? t("nutrition.suggest.generating") : t("nutrition.suggest.again")}
          </Button>
        ) : null}
      </div>

      {!data ? (
        <>
          <p className="text-xs leading-relaxed" style={{ color: appColors.textMuted }}>
            {t("nutrition.suggest.hint")}
          </p>
          <div>
            <Button size="sm" leftIcon={<Sparkles size={14} />} onClick={() => generate(false)} disabled={busy != null}>
              {busy === "generate" ? t("nutrition.suggest.generating") : t("nutrition.suggest.generate")}
            </Button>
          </div>
        </>
      ) : (
        <>
          {data.meals.map((m, i) => {
            const key = `${m.meal}-${i}`;
            const done = added.has(key);
            return (
              <div key={key} className="flex flex-col gap-1.5 rounded-xl p-3" style={{ background: appColors.surfaceCardBorder }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[11px] uppercase tracking-wide" style={{ color: appColors.textMuted }}>
                      {t(`nutrition.meals.${m.meal}` as TKey)}
                    </div>
                    <div className="text-sm font-semibold" style={{ color: appColors.textPrimary }}>
                      {m.title || t(`nutrition.meals.${m.meal}` as TKey)}
                    </div>
                  </div>
                  <Button
                    size="xs"
                    variant={done ? "ghost" : "secondary"}
                    leftIcon={done ? undefined : <Plus size={12} />}
                    onClick={() => add(m, key)}
                    disabled={busy != null || done}
                  >
                    {done ? "✓" : t("nutrition.suggest.add")}
                  </Button>
                </div>
                <ul className="text-xs flex flex-col gap-0.5" style={{ color: appColors.textSecondary }}>
                  {m.items.map((it, j) => (
                    <li key={j} className="flex justify-between gap-2">
                      <span className="truncate">{it.name}</span>
                      <span className="tabular-nums shrink-0" style={{ color: appColors.textMuted }}>
                        {it.grams ? `${fmtInt(it.grams, locale)} g` : ""}
                        {!simple ? ` · ${fmtInt(it.kcal, locale)} kcal` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
                {m.why ? (
                  <p className="text-[11px] leading-relaxed" style={{ color: appColors.textMuted }}>
                    {m.why}
                  </p>
                ) : null}
              </div>
            );
          })}
          {!simple ? (
            <p className="text-xs tabular-nums" style={{ color: appColors.textMuted }}>
              {fmt(t("nutrition.suggest.totals"), {
                n: fmtInt(data.totals.kcal, locale),
                r: fmtInt(data.remaining.kcal, locale),
              })}
            </p>
          ) : null}
          {data.note ? (
            <p className="text-xs" style={{ color: appColors.textMuted }}>
              {data.note}
            </p>
          ) : null}
          <p className="text-[11px] leading-relaxed" style={{ color: appColors.textMuted }}>
            {t("nutrition.suggest.disclaimer")}
          </p>
        </>
      )}
    </section>
  );
}
