// src/app/shared/components/widgets/WidgetRouteMatch.tsx
"use client";

import { useEffect, useState } from "react";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { useUserId } from "@/app/shared/hooks/useUserId";
import {
  apiGetRouteOverview,
  type RouteOverviewEntry,
} from "@/app/features/activities/api/activities_enrichment";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import {
  WIDGET_LOADING_WRAP,
  WIDGET_NOTE,
} from "@/app/shared/ui/tokens";
import { useT } from "@/app/shared/i18n/useT";

const SPORT_ICON: Record<string, string> = {
  run: "🏃",
  ride: "🚴",
  swim: "🏊",
};

function RouteRow({ entry }: { entry: RouteOverviewEntry }) {
  const icon = SPORT_ICON[String(entry.sport_type_fe || "").toLowerCase()] ?? "📍";
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "6px 0",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
        <span style={{ fontSize: 14 }}>{icon}</span>
        <span
          style={{
            fontSize: 13,
            color: appColors.textPrimary,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {entry.route_match}
        </span>
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color: appColors.textMuted, flexShrink: 0 }}>
        {entry.count}×
      </span>
    </div>
  );
}

export default function WidgetRouteMatch({ onOpenDetail }: { onOpenDetail?: () => void }) {
  const { userId } = useUserId();
  const t = useT();
  const [loading, setLoading] = useState(true);
  const [routes, setRoutes] = useState<RouteOverviewEntry[]>([]);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    apiGetRouteOverview(Number(userId))
      .then((rows) => {
        if (alive) setRoutes(rows);
      })
      .catch((e) => console.error("[WidgetRouteMatch]", e))
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [userId]);

  const top3 = routes.slice(0, 3);

  return (
    <WidgetCard
      title={t("sessions.routeMatch.widgetTitle")}
      accent="none"
      onOpen={onOpenDetail}
      interactive={!!onOpenDetail}
      minH={160}
    >
      {loading ? (
        <div className={WIDGET_LOADING_WRAP}>
          <LoadingSpinner size="widget" />
        </div>
      ) : top3.length === 0 ? (
        <p className={WIDGET_NOTE}>{t("sessions.routeMatch.widgetEmpty")}</p>
      ) : (
        <>
          {top3.map((r) => (
            <RouteRow key={r.route_match} entry={r} />
          ))}
          {routes.length > 3 && (
            <p className={WIDGET_NOTE} style={{ marginTop: 4 }}>
              {(t("sessions.routeMatch.widgetMore") || "").replace(
                "{{count}}",
                String(routes.length - 3),
              )}
            </p>
          )}
        </>
      )}
    </WidgetCard>
  );
}