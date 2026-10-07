"use client";

import { HeartPulse } from "lucide-react";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import { usePerformanceData } from "@/app/shared/components/dataProviders/PerformanceDataProvider";
import { useT } from "@/app/shared/i18n/useT";
import { useSettings } from "@/app/shared/i18n/SettingsProvider";
import { WK } from "@/app/shared/ui/tokens/widgets";
import { Hero, IconTile, WidgetEmpty, WidgetLoading, ZoneColumns } from "@/app/shared/ui/widget/WidgetParts";
import { ZONE_COLORS, fmtShortDate, performanceInfo } from "@/app/features/performance/utils/performanceWidget";
import { localeTag } from "@/app/shared/i18n/locale";

type Props = { onOpenDetail?: () => void };

export default function WidgetZonesHR({ onOpenDetail }: Props) {
  const t = useT();
  const { settings } = useSettings() as any;
  const locale = localeTag(settings?.language);
  const { data, loading } = usePerformanceData();
  const z = data.latestZones;
  const n = (v: number | null | undefined) => (v ? String(Math.round(v)) : "—");

  return (
    <WidgetCard
      title={t("zonesHR.widget.title")}
      tooltip={performanceInfo(t, "zonesHR")}
      onOpen={onOpenDetail}
      interactive={!!onOpenDetail}
      accent="none"
      minH={160}
    >
      {loading && !z ? (
        <WidgetLoading />
      ) : !z ? (
        <WidgetEmpty icon={HeartPulse} text={t("performanceWidgets.noZones")} />
      ) : (
        <div className={WK.stack}>
          {/* hlavné číslo = horná hranica Z2 – pod ňou idú všetky ľahké behy */}
          <Hero
            icon={<IconTile icon={HeartPulse} color={ZONE_COLORS[1]} />}
            value={n(z.z2_max)}
            unit={t("recoveryWidgets.bpm")}
            sub={[t("performanceWidgets.easyCeiling"), fmtShortDate(z.created_at, locale)].filter(Boolean).join(" · ")}
          />
          <ZoneColumns
            items={[
              { label: "Z1", value: `<${n(z.z1_max)}`, color: ZONE_COLORS[0] },
              { label: "Z2", value: n(z.z2_min), color: ZONE_COLORS[1] },
              { label: "Z3", value: n(z.z3_min), color: ZONE_COLORS[2] },
              { label: "Z4", value: n(z.z4_min), color: ZONE_COLORS[3] },
              { label: "Z5", value: `${n(z.z5_min)}+`, color: ZONE_COLORS[4] },
            ]}
          />
        </div>
      )}
    </WidgetCard>
  );
}
