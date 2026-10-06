"use client";

import * as React from "react";
import { Scale, TrendingDown, TrendingUp, Minus } from "lucide-react";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import { usePerformanceData } from "@/app/shared/components/dataProviders/PerformanceDataProvider";
import { useT } from "@/app/shared/i18n/useT";
import { useSettings } from "@/app/shared/i18n/SettingsProvider";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { WK } from "@/app/shared/ui/tokens/widgets";
import {
  Caption,
  Hero,
  IconTile,
  Pill,
  Sparkline,
  WidgetEmpty,
  WidgetLoading,
  type Tone,
} from "@/app/shared/ui/widget/WidgetParts";
import { fmt1, fmtShortDate, performanceInfo, trendValues } from "@/app/features/performance/utils/performanceWidget";

type Props = {
  onOpen?: () => void;
  onOpenDetail?: () => void;
  showAdvanced?: boolean;
};

/** BMI pásma WHO; pre športovca s veľa svalmi je BMI len orientačné */
function bmiLevel(bmi: number): { key: string; tone: Tone } {
  if (bmi < 18.5) return { key: "underweight", tone: "warn" };
  if (bmi < 25) return { key: "normal", tone: "good" };
  if (bmi < 30) return { key: "overweight", tone: "warn" };
  return { key: "obese", tone: "danger" };
}

export default function WidgetBodyWeight({ onOpen, onOpenDetail, showAdvanced = false }: Props) {
  const handleOpen = onOpen ?? onOpenDetail;
  const t = useT();
  const { settings } = useSettings() as any;
  const locale = settings?.language === "en" ? "en-GB" : "sk-SK";
  const { data, loading } = usePerformanceData();
  const { weightLatest, profileStatic, bodyWeightTrend } = data;

  const weight: number | null = weightLatest?.value ?? null;
  const height: number | null = profileStatic?.height_cm ?? null;
  const bmi = weight && height ? weight / (height / 100) ** 2 : null;
  const lvl = bmi != null ? bmiLevel(bmi) : null;

  const spark = React.useMemo(() => trendValues(bodyWeightTrend).slice(-30), [bodyWeightTrend]);
  // zmena za zobrazené obdobie – váha nie je dobrá ani zlá, preto neutrálny štítok
  const diff = spark.length >= 2 ? spark[spark.length - 1] - spark[0] : null;
  const DiffIcon = diff == null || Math.abs(diff) < 0.3 ? Minus : diff > 0 ? TrendingUp : TrendingDown;

  return (
    <WidgetCard
      title={t("performance.metrics.weightLabel")}
      tooltip={performanceInfo(t, "bodyWeight")}
      onOpen={handleOpen}
      interactive={!!handleOpen}
      accent="none"
      minH={160}
    >
      {loading && !weightLatest ? (
        <WidgetLoading />
      ) : weight == null ? (
        <WidgetEmpty icon={Scale} text={t("performanceWidgets.noMeasurement")} />
      ) : (
        <div className={WK.stack}>
          <Hero
            icon={<IconTile icon={Scale} color={appColors.chartRecoveryMain} />}
            value={fmt1(weight, locale)}
            unit={t("common.units.kg")}
            sub={fmtShortDate(weightLatest?.measured_at, locale) || undefined}
            right={
              diff != null ? (
                <Pill
                  tone="neutral"
                  icon={DiffIcon}
                  label={`${diff > 0 ? "+" : ""}${fmt1(diff, locale)} ${t("common.units.kg")}`}
                />
              ) : null
            }
          />
          <Sparkline values={spark} color={appColors.chartRecoveryMain} />
          {showAdvanced && bmi != null && lvl ? (
            <Caption>
              {t("performance.metrics.bmiLabel")} {fmt1(bmi, locale)} · {t(`common.levels.${lvl.key}` as any)}
            </Caption>
          ) : null}
        </div>
      )}
    </WidgetCard>
  );
}
