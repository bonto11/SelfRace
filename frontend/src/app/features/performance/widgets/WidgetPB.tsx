"use client";

import { useMemo } from "react";
import { Trophy } from "lucide-react";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import { useFavoritePBRun } from "@/app/features/bests/hooks/useFavoritePBRun";
import { usePerformanceExtras } from "@/app/shared/components/dataProviders/PerformanceDataProvider";
import { useEnsure } from "@/app/shared/components/dataProviders/useCachedResource";
import { distanceLabel } from "@/app/features/bests/utils/bests";
import { type UserBest } from "@/app/features/bests/types/bests";
import { secToHHMMSS } from "@/app/shared/utils/time";
import { useT } from "@/app/shared/i18n/useT";
import { useSettings } from "@/app/shared/i18n/SettingsProvider";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { WK } from "@/app/shared/ui/tokens/widgets";
import { Caption, Hero, IconTile, WidgetEmpty, WidgetLoading } from "@/app/shared/ui/widget/WidgetParts";
import { fmtPace, fmtShortDate, performanceInfo } from "@/app/features/performance/utils/performanceWidget";
import { localeTag } from "@/app/shared/i18n/locale";

const NO_BESTS: UserBest[] = [];

export default function WidgetPB({ onOpenDetail }: { onOpenDetail?: () => void }) {
  const { favM } = useFavoritePBRun();
  const t = useT();
  const { settings } = useSettings() as any;
  const locale = localeTag(settings?.language);
  const { bestsRun } = usePerformanceExtras();
  useEnsure(bestsRun);
  const rows: UserBest[] = bestsRun.data ?? NO_BESTS;
  const loading = !bestsRun.loaded;

  const fav = useMemo(() => (favM ? rows.find((r) => r.distance_m === favM) ?? null : null), [rows, favM]);

  const time = fav?.best_time_s != null ? secToHHMMSS(fav.best_time_s) : fav?.time_str ?? "—";
  const pace = fav?.best_time_s && fav?.distance_m ? fmtPace(fav.best_time_s / (fav.distance_m / 1000)) : null;
  const when = [fav?.activity_name, fmtShortDate(fav?.achieved_at, locale)].filter(Boolean).join(" · ");

  return (
    <WidgetCard
      title={t("PB.widget.title")}
      tooltip={performanceInfo(t, "pb")}
      accent="none"
      onOpen={onOpenDetail}
      interactive={!!onOpenDetail}
      minH={140}
    >
      {loading ? (
        <WidgetLoading />
      ) : !fav ? (
        <WidgetEmpty icon={Trophy} text={t("PB.widget.empty")} />
      ) : (
        <div className={WK.stack}>
          <Hero
            icon={<IconTile icon={Trophy} color={appColors.statusWarning} />}
            value={time}
            unit={favM ? distanceLabel(favM, "run") : undefined}
            sub={pace ? `${pace} /km` : undefined}
          />
          {when ? <Caption>{when}</Caption> : null}
        </div>
      )}
    </WidgetCard>
  );
}
