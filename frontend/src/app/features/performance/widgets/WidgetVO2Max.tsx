"use client";

import * as React from "react";
import { Wind } from "lucide-react";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import vo2Ref from "@/app/data/VO2Max_Ref_RunnersWorld.json";
import { useT } from "@/app/shared/i18n/useT";
import { useSettings } from "@/app/shared/i18n/SettingsProvider";
import { usePerformanceData } from "@/app/shared/components/dataProviders/PerformanceDataProvider";
import { WK } from "@/app/shared/ui/tokens/widgets";
import {
  Caption,
  Hero,
  IconTile,
  Pill,
  Sparkline,
  WidgetEmpty,
  WidgetLoading,
  toneColor,
} from "@/app/shared/ui/widget/WidgetParts";
import type { Group } from "@/app/features/performance/types/performance";
import {
  fmt1,
  fmtShortDate,
  levelText,
  levelTone,
  performanceInfo,
  trendPoints,
} from "@/app/features/performance/utils/performanceWidget";
import { localeTag } from "@/app/shared/i18n/locale";

type Props = {
  onOpen?: () => void;
  onOpenDetail?: () => void;
  showAdvanced?: boolean;
};

export default function WidgetVO2Max({ onOpen, onOpenDetail, showAdvanced = false }: Props) {
  const handleOpen = onOpen ?? onOpenDetail;
  const t = useT();
  const { settings } = useSettings() as any;
  const locale = localeTag(settings?.language);
  const { data, loading } = usePerformanceData();
  const { vo2MeasuredLatest, vo2EstimatedLatest, vo2EstimatedTrend, profileStatic } = data;

  // pohlavie a vek z profilu; meranie ich nesie len keď existuje
  const sex = (profileStatic?.sex ?? vo2MeasuredLatest?.sex) === "F" ? "F" : "M";
  const birthDate = profileStatic?.birth_date ?? vo2MeasuredLatest?.birth_date ?? "";

  const ranges = React.useMemo(() => {
    const age = birthDate ? Math.floor((Date.now() - +new Date(birthDate)) / 3.156e10) : 0;
    const g = (vo2Ref as Group[]).find((x) => x.sex === sex && age >= x.age_min && age <= x.age_max);
    return g?.ranges ?? [];
  }, [birthDate, sex]);

  const level = (v: number | null) => {
    if (v == null) return null;
    return ranges.find((r) => (r.min == null || v >= r.min) && (r.max == null || v <= r.max))?.label ?? null;
  };

  const est: number | null = vo2EstimatedLatest?.value ?? null;
  const measured: number | null = vo2MeasuredLatest?.value ?? null;
  const lvl = level(est);
  const tone = levelTone(lvl);
  const spark = React.useMemo(() => trendPoints(vo2EstimatedTrend).slice(-12), [vo2EstimatedTrend]);
  const date = fmtShortDate(vo2EstimatedLatest?.measured_at, locale);

  return (
    <WidgetCard
      title={t("VO2Max.widget.title")}
      tooltip={performanceInfo(t, "vo2max")}
      onOpen={handleOpen}
      interactive={!!handleOpen}
      accent="none"
      minH={160}
    >
      {loading && !vo2EstimatedLatest ? (
        <WidgetLoading />
      ) : est == null ? (
        <WidgetEmpty icon={Wind} text={t("VO2Max.noData")} />
      ) : (
        <div className={WK.stack}>
          <Hero
            icon={<IconTile icon={Wind} color={toneColor(tone)} />}
            value={fmt1(est, locale)}
            unit={t("common.units.vo2max")}
            sub={date ? `${t("VO2Max.chart.estimated")} · ${date}` : t("VO2Max.chart.estimated")}
            right={lvl ? <Pill tone={tone} label={levelText(t, lvl)} /> : null}
          />
          <Sparkline points={spark} color={toneColor(tone)} />
          {showAdvanced && measured != null ? (
            <Caption>
              {t("VO2Max.chart.measured")}: {fmt1(measured, locale)} · {fmtShortDate(vo2MeasuredLatest?.measured_at, locale)}
            </Caption>
          ) : null}
        </div>
      )}
    </WidgetCard>
  );
}
