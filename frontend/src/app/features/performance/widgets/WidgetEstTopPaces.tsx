"use client";

import { Timer } from "lucide-react";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import { usePerformanceData } from "@/app/shared/components/dataProviders/PerformanceDataProvider";
import { useT } from "@/app/shared/i18n/useT";
import { useSettings } from "@/app/shared/i18n/SettingsProvider";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { WK } from "@/app/shared/ui/tokens/widgets";
import { Hero, IconTile, MiniStat, WidgetEmpty, WidgetLoading } from "@/app/shared/ui/widget/WidgetParts";
import {
  fmtRaceTime,
  fmtShortDate,
  performanceInfo,
} from "@/app/features/performance/utils/performanceWidget";

type Props = { onOpenDetail?: () => void };

export default function WidgetEstTopPaces({ onOpenDetail }: Props) {
  const t = useT();
  const { settings } = useSettings() as any;
  const locale = settings?.language === "en" ? "en-GB" : "sk-SK";
  const { data, loading } = usePerformanceData();
  const p = data.latestPace;
  const dec = locale.startsWith("sk") ? "," : ".";
  const date = fmtShortDate(p?.measured_at, locale);

  return (
    <WidgetCard
      title={t("estTopPaces.widget.title")}
      tooltip={performanceInfo(t, "estTopPaces")}
      onOpen={onOpenDetail}
      interactive={!!onOpenDetail}
      accent="none"
      minH={160}
    >
      {loading && !p ? (
        <WidgetLoading />
      ) : !p?.est_5k_time_s ? (
        <WidgetEmpty icon={Timer} text={t("performanceWidgets.noEstimate")} />
      ) : (
        <div className={WK.stack}>
          <Hero
            icon={<IconTile icon={Timer} color={appColors.chartRecoveryMain} />}
            value={fmtRaceTime(p.est_5k_time_s)}
            unit="5 km"
            sub={date ? `${t("performanceWidgets.estimateAt")} ${date}` : undefined}
          />
          <div className="grid grid-cols-3 gap-2">
            <MiniStat value={fmtRaceTime(p.est_10k_time_s)} label="10 km" />
            <MiniStat value={fmtRaceTime(p.est_half_marathon_time_s)} label={`21${dec}1 km`} />
            <MiniStat value={fmtRaceTime(p.est_marathon_time_s)} label={`42${dec}2 km`} />
          </div>
        </div>
      )}
    </WidgetCard>
  );
}
