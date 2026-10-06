"use client";

import * as React from "react";
import { Percent } from "lucide-react";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import { getBodyFatBands } from "@/app/shared/utils/bands";
import { usePerformanceData } from "@/app/shared/components/dataProviders/PerformanceDataProvider";
import { useT } from "@/app/shared/i18n/useT";
import { useSettings } from "@/app/shared/i18n/SettingsProvider";
import { WK } from "@/app/shared/ui/tokens/widgets";
import {
  Hero,
  IconTile,
  Pill,
  Sparkline,
  WidgetEmpty,
  WidgetLoading,
  toneColor,
} from "@/app/shared/ui/widget/WidgetParts";
import {
  fmt1,
  fmtShortDate,
  levelText,
  levelTone,
  performanceInfo,
  trendPoints,
} from "@/app/features/performance/utils/performanceWidget";

type Props = { onOpen?: () => void; onOpenDetail?: () => void };

export default function WidgetBodyFat({ onOpen, onOpenDetail }: Props) {
  const handleOpen = onOpen ?? onOpenDetail;
  const t = useT();
  const { settings } = useSettings() as any;
  const locale = settings?.language === "en" ? "en-GB" : "sk-SK";
  const { data, loading } = usePerformanceData();
  const { bodyFatLatest, bodyFatTrend, profileStatic, vo2MeasuredLatest } = data;

  const pct: number | null = bodyFatLatest?.value ?? null;
  const sex = (profileStatic?.sex ?? vo2MeasuredLatest?.sex) === "F" ? "F" : "M";
  const band =
    pct != null
      ? getBodyFatBands(sex).find((b) => (b.min == null || pct >= b.min) && (b.max == null || pct <= b.max))
      : null;
  const tone = levelTone(band?.label);
  const spark = React.useMemo(() => trendPoints(bodyFatTrend).slice(-30), [bodyFatTrend]);

  return (
    <WidgetCard
      title={t("bodyFat.widget.title")}
      tooltip={performanceInfo(t, "bodyFat")}
      onOpen={handleOpen}
      interactive={!!handleOpen}
      accent="none"
      minH={160}
    >
      {loading && !bodyFatLatest ? (
        <WidgetLoading />
      ) : pct == null ? (
        <WidgetEmpty icon={Percent} text={t("performanceWidgets.noMeasurement")} />
      ) : (
        <div className={WK.stack}>
          <Hero
            icon={<IconTile icon={Percent} color={toneColor(tone)} />}
            value={fmt1(pct, locale)}
            unit="%"
            sub={fmtShortDate(bodyFatLatest?.measured_at, locale) || undefined}
            right={band ? <Pill tone={tone} label={levelText(t, band.label)} /> : null}
          />
          <Sparkline points={spark} color={toneColor(tone)} />
        </div>
      )}
    </WidgetCard>
  );
}
