// src/app/features/activities/components/DetailRouteMatch.tsx
"use client";

import { useEffect, useState } from "react";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { useT } from "@/app/shared/i18n/useT";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { CARD, SURFACE_CARD_STYLE } from "@/app/shared/ui/tokens";
import {
  apiGetRouteOverview,
  apiCompareRouteMatch,
  type RouteOverviewEntry,
  type RouteMatchComparison,
} from "@/app/features/activities/api/activities_enrichment";
import { fmtSecondsHMS } from "@/app/shared/utils/time";
import { formatDistance } from "@/app/shared/utils/distance";

const SPORT_ICON: Record<string, string> = {
  run: "🏃",
  ride: "🚴",
  swim: "🏊",
};

function RouteListRow({
  entry,
  isSelected,
  onClick,
}: {
  entry: RouteOverviewEntry;
  isSelected: boolean;
  onClick: () => void;
}) {
  const icon = SPORT_ICON[String(entry.sport_type_fe || "").toLowerCase()] ?? "📍";
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left"
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "12px 16px",
        borderBottom: `1px solid ${appColors.divider}`,
        background: isSelected ? appColors.surfaceCardHover : "transparent",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: appColors.textPrimary }}>
          {entry.route_match}
        </span>
      </div>
      <span style={{ fontSize: 13, fontWeight: 700, color: appColors.textMuted }}>
        {entry.count}×
      </span>
    </button>
  );
}

function ComparisonPanel({ comparison }: { comparison: RouteMatchComparison }) {
  const t = useT();
  const { activities, stats } = comparison;

  return (
    <section className={CARD} style={{ ...SURFACE_CARD_STYLE, marginTop: 12 }}>
      <div style={{ padding: "14px 16px" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: appColors.textPrimary }}>
          {comparison.route_match}
        </div>
        <div style={{ fontSize: 12, color: appColors.textMuted, marginTop: 4 }}>
          {stats.count} {t("sessions.routeMatch.activitiesCount")}
          {stats.median_distance_m != null && (
            <> · {formatDistance(stats.median_distance_m)}</>
          )}
          {stats.best_time_s != null && (
            <>
              {" · "}
              {t("sessions.routeMatch.bestTime")}: {fmtSecondsHMS(stats.best_time_s)}
            </>
          )}
        </div>
      </div>

      <div>
        {activities.map((a) => (
          <div
            key={a.activity_id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "10px 16px",
              borderTop: `1px solid ${appColors.divider}`,
            }}
          >
            <span style={{ fontSize: 13, color: appColors.textMuted }}>
              {a.updated_at ? new Date(a.updated_at).toLocaleDateString("sk-SK") : "—"}
            </span>
            <div style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
              {a.moving_time_s != null && (
                <span style={{ fontSize: 14, fontWeight: 700, color: appColors.textPrimary }}>
                  {fmtSecondsHMS(a.moving_time_s)}
                </span>
              )}
              {a.distance_m != null && (
                <span style={{ fontSize: 12, color: appColors.textMuted }}>
                  {formatDistance(a.distance_m)}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─── HLAVNÝ KOMPONENT ─── */
export default function DetailRouteMatch() {
  const { userId } = useUserId();
  const t = useT();

  const [loading, setLoading] = useState(true);
  const [routes, setRoutes] = useState<RouteOverviewEntry[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [comparison, setComparison] = useState<RouteMatchComparison | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    apiGetRouteOverview(Number(userId))
      .then((rows) => {
        if (alive) setRoutes(rows);
      })
      .catch((e) => console.error("[DetailRouteMatch]", e))
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [userId]);

  const handleSelect = async (routeName: string) => {
    if (!userId) return;
    setSelected(routeName);
    setComparisonLoading(true);
    try {
      const out = await apiCompareRouteMatch(Number(userId), routeName);
      setComparison(out);
    } finally {
      setComparisonLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
        <LoadingSpinner size="trend" />
      </div>
    );
  }

  if (routes.length === 0) {
    return (
      <div className={CARD} style={SURFACE_CARD_STYLE}>
        <p style={{ padding: 20, textAlign: "center", color: appColors.textMuted, fontSize: 13 }}>
          {t("sessions.routeMatch.pageEmpty")}
        </p>
      </div>
    );
  }

  return (
    <>
      <section className={CARD} style={SURFACE_CARD_STYLE}>
        {routes.map((r) => (
          <RouteListRow
            key={r.route_match}
            entry={r}
            isSelected={selected === r.route_match}
            onClick={() => handleSelect(r.route_match)}
          />
        ))}
      </section>

      {comparisonLoading && (
        <div style={{ display: "flex", justifyContent: "center", padding: 24 }}>
          <LoadingSpinner size="trend" />
        </div>
      )}

      {!comparisonLoading && comparison && <ComparisonPanel comparison={comparison} />}
    </>
  );
}