"use client";

import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import { useActivityData } from "@/app/shared/components/dataProviders/ActivityDataProvider";
import { useEnsure } from "@/app/shared/components/dataProviders/useCachedResource";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { Route } from "lucide-react";
import { useT } from "@/app/shared/i18n/useT";
import { Caption, IconTile, ListRow, SportTile, WidgetLoading } from "@/app/shared/ui/widget/WidgetParts";
import { activityInfo } from "@/app/features/activities/utils/activityInfo";

export default function WidgetRouteMatch({ onOpenDetail }: { onOpenDetail?: () => void }) {
  const t = useT();
  const { routeOverview } = useActivityData();
  useEnsure(routeOverview);
  const loading = !routeOverview.loaded;
  const routes = routeOverview.data ?? [];

  const top3 = routes.slice(0, 3);

  return (
    <WidgetCard
      title={t("sessions.routeMatch.widgetTitle")}
      tooltip={activityInfo(t, "routes")}
      accent="none"
      onOpen={onOpenDetail}
      interactive={!!onOpenDetail}
      minH={160}
    >
      {loading ? (
        <WidgetLoading />
      ) : top3.length === 0 ? (
        <div className="flex items-center gap-2.5">
          <IconTile icon={Route} color={appColors.textMuted} />
          <p className="text-sm" style={{ color: appColors.textMuted }}>
            {t("sessions.routeMatch.widgetEmpty")}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5 text-left">
          {top3.map((r) => (
            <ListRow
              key={r.route_match}
              icon={<SportTile sport={r.sport_type_fe} />}
              label={r.route_match}
              value={`${r.count}×`}
            />
          ))}
          {routes.length > 3 ? (
            <Caption>
              {(t("sessions.routeMatch.widgetMore") || "").replace("{{count}}", String(routes.length - 3))}
            </Caption>
          ) : null}
        </div>
      )}
    </WidgetCard>
  );
}
