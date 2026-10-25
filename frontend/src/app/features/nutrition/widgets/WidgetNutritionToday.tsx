"use client";

import type { ReactNode } from "react";
import { Apple, UtensilsCrossed } from "lucide-react";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import { useNutritionData, useNutritionFuel } from "@/app/shared/components/dataProviders/NutritionDataProvider";
import { fmt, useT, type TKey } from "@/app/shared/i18n/useT";
import { useSettings } from "@/app/shared/i18n/SettingsProvider";
import { localeTag } from "@/app/shared/i18n/locale";
import { WK } from "@/app/shared/ui/tokens/widgets";
import {
  Caption,
  Hero,
  IconTile,
  Pill,
  ProgressRow,
  WidgetEmpty,
  WidgetLoading,
} from "@/app/shared/ui/widget/WidgetParts";
import PlateGuide from "@/app/features/nutrition/components/PlateGuide";
import type { DayLoad } from "@/app/features/nutrition/types/nutrition";
import {
  MACRO_COLOR,
  MACRO_KEYS,
  fmtInt,
  nutritionInfo,
} from "@/app/features/nutrition/utils/nutrition";

type Props = { onOpenDetail?: () => void };

// zajtrajšok, pri ktorom treba už dnes večer myslieť na jedlo
const NEXT_HINT_LOADS = new Set<DayLoad>(["hard", "load", "race"]);

/**
 * Výživa dnes: zjedené kcal z cieľa + tri makrá (v režime bez počítania
 * tanier podľa dňa). Cieľ počíta BE podľa tréningov dňa
 * (Services/nutrition_targets.py). Tichý riadok = čo chystá zajtrajšok.
 */
export default function WidgetNutritionToday({ onOpenDetail }: Props) {
  const t = useT();
  const { settings } = useSettings() as any;
  const locale = localeTag(settings?.language);
  const { today, loading, error } = useNutritionData();
  const fuel = useNutritionFuel();
  const nextLoad = fuel.data?.days?.[1]?.day_load ?? null;
  const nextHint = nextLoad && NEXT_HINT_LOADS.has(nextLoad) ? t(`nutrition.widget.next.${nextLoad}` as TKey) : null;
  const simple = today?.profile?.mode === "simple";

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
  } else if (simple && load) {
    body = (
      <div className={WK.stack}>
        <Hero
          size="md"
          icon={<IconTile icon={Apple} color={MACRO_COLOR.kcal} />}
          value={t(`nutrition.load.${load}` as TKey)}
        />
        <PlateGuide load={load} compact />
        {nextHint ? <Caption>{nextHint}</Caption> : null}
      </div>
    );
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
              tone={left >= 0 ? "good" : "neutral"}
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
        {nextHint ? <Caption>{nextHint}</Caption> : null}
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
