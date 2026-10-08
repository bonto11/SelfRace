"use client";

import { Gauge } from "lucide-react";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import { usePerformanceData } from "@/app/shared/components/dataProviders/PerformanceDataProvider";
import { useT } from "@/app/shared/i18n/useT";
import { useSettings } from "@/app/shared/i18n/SettingsProvider";
import { WK } from "@/app/shared/ui/tokens/widgets";
import { Hero, IconTile, WidgetEmpty, WidgetLoading, ZoneColumns } from "@/app/shared/ui/widget/WidgetParts";
import { ZONE_COLORS, fmtPace, fmtShortDate, performanceInfo } from "@/app/features/performance/utils/performanceWidget";
import { localeTag } from "@/app/shared/i18n/locale";

type Props = { onOpenDetail?: () => void };

export default function WidgetZonesPaces({ onOpenDetail }: Props) {
  const t = useT();
  const { settings } = useSettings() as any;
  const locale = localeTag(settings?.language);
  const { data, loading } = usePerformanceData();
  const p = data.latestPace;

  return (
    <WidgetCard
      title={t("zonesPaces.widget.title")}
      tooltip={performanceInfo(t, "zonesPaces")}
      onOpen={onOpenDetail}
      interactive={!!onOpenDetail}
      accent="none"
      minH={160}
    >
      {loading && !p ? (
        <WidgetLoading />
      ) : !p?.z2_pace_s ? (
        <WidgetEmpty icon={Gauge} text={t("performanceWidgets.noEstimate")} />
      ) : (
        <div className={WK.stack}>
          {/* Z2 = tempo väčšiny tréningov, preto ide hore */}
          <Hero
            icon={<IconTile icon={Gauge} color={ZONE_COLORS[1]} />}
            value={fmtPace(p.z2_pace_s)}
            unit="/km"
            sub={[t("performanceWidgets.easyPace"), fmtShortDate(p.measured_at, locale)].filter(Boolean).join(" · ")}
          />
          <ZoneColumns
            items={[p.z1_pace_s, p.z2_pace_s, p.z3_pace_s, p.z4_pace_s, p.z5_pace_s].map((v, i) => ({
              label: `Z${i + 1}`,
              value: fmtPace(v),
              color: ZONE_COLORS[i],
            }))}
          />
        </div>
      )}
    </WidgetCard>
  );
}
