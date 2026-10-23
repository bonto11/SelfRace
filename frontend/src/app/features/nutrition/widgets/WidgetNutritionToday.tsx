"use client";

import type { ReactNode } from "react";
import { Apple, UtensilsCrossed } from "lucide-react";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import { useNutritionData } from "@/app/shared/components/dataProviders/NutritionDataProvider";
import { fmt, useT, type TKey } from "@/app/shared/i18n/useT";
import { useSettings } from "@/app/shared/i18n/SettingsProvider";
import { localeTag } from "@/app/shared/i18n/locale";
import { WK } from "@/app/shared/ui/tokens/widgets";
import {
  Hero,
  IconTile,
  Pill,
  ProgressRow,
  WidgetEmpty,
  WidgetLoading,
} from "@/app/shared/ui/widget/WidgetParts";
import {
  MACRO_COLOR,
  MACRO_KEYS,
  fmtInt,
  nutritionInfo,
} from "@/app/features/nutrition/utils/nutrition";

type Props = { onOpenDetail?: () => void };

/**
 * Výživa dnes: zjedené kcal z cieľa + tri makrá. Cieľ počíta BE podľa
 * tréningov dňa (Services/nutrition_targets.py).
 */
export default function WidgetNutritionToday({ onOpenDetail }: Props) {
  const t = useT();
  const { settings } = useSettings() as any;
  const locale = localeTag(settings?.language);
  const { today, loading, error } = useNutritionData();

  const targets = today?.targets ?? null;
  const eaten = today?.eaten ?? { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
  const load = today?.breakdown?.day_load;

  let body: ReactNode;
  if (loading && !today) {
    body = <WidgetLoading />;
  } else if (error && !today) {
    body = <WidgetEmpty icon={UtensilsCrossed} text={t("nutrition.errors.request_failed")} tone="warn" />;
  } else if (!today?.profile) {
    body = <WidgetEmpty icon={Apple} text={t("nutrition.widget.setup")} />;
  } else if (!targets) {
    body = <WidgetEmpty icon={Apple} text={t("nutrition.widget.missingBody")} tone="warn" />;
  } else {
    const left = targets.kcal - eaten.kcal;
    body = (
      <div className={WK.stack}>
        <Hero
          icon={<IconTile icon={Apple} color={MACRO_COLOR.kcal} />}
          value={fmtInt(eaten.kcal, locale)}
          unit={`/ ${fmtInt(targets.kcal, locale)} kcal`}
          sub={load ? t(`nutrition.load.${load}` as TKey) : undefined}
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
      </div>
    );
  }

  return (
    <WidgetCard
      title={t("nutrition.widget.title")}
      tooltip={nutritionInfo(t)}
      onOpen={onOpenDetail}
      interactive={!!onOpenDetail}
      accent="none"
      minH={160}
    >
      {body}
    </WidgetCard>
  );
}
