// src/app/features/activities/components/DetailRouteMatch.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
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

/* ─── HELPERS ─── */

function formatPaceFromSpeed(speedMps: number | null | undefined): string | null {
  if (!speedMps || speedMps <= 0) return null;
  const secPerKm = 1000 / speedMps;
  const minutes = Math.floor(secPerKm / 60);
  const seconds = String(Math.round(secPerKm % 60)).padStart(2, "0");
  return `${minutes}:${seconds}/km`;
}

function paceSecondsFromSpeed(speedMps: number | null | undefined): number | null {
  if (!speedMps || speedMps <= 0) return null;
  return 1000 / speedMps;
}

function formatSecondsAsPace(sec: number): string {
  const minutes = Math.floor(sec / 60);
  const seconds = String(Math.round(sec % 60)).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function fmtShortDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("sk-SK", { day: "2-digit", month: "2-digit" });
}

/* ─── LIST ROW ─── */

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

/* ─── TREND CHART (tempo naprieč behmi, chronologicky) ─── */

function PaceTrendChart({
  activities,
}: {
  activities: RouteMatchComparison["activities"];
}) {
  const t = useT();

  const chartData = useMemo(() => {
    return [...activities]
      .filter((a) => a.average_speed_mps != null)
      .sort((a, b) => (a.updated_at ?? "").localeCompare(b.updated_at ?? ""))
      .map((a) => ({
        date: fmtShortDate(a.updated_at),
        paceSec: paceSecondsFromSpeed(a.average_speed_mps),
      }))
      .filter((d) => d.paceSec != null);
  }, [activities]);

  if (chartData.length < 2) return null;

  return (
    <div style={{ padding: "8px 16px 16px" }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: appColors.textMuted,
          marginBottom: 8,
        }}
      >
        {t("sessions.routeMatch.paceTrend")}
      </div>
      <div style={{ width: "100%", height: 140 }}>
        <ResponsiveContainer>
          <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={appColors.divider} vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: appColors.textMuted }}
              axisLine={{ stroke: appColors.divider }}
              tickLine={false}
            />
            <YAxis
              reversed
              tick={{ fontSize: 11, fill: appColors.textMuted }}
              axisLine={false}
              tickLine={false}
              width={40}
              tickFormatter={(v) => formatSecondsAsPace(v)}
            />
            <Tooltip
              contentStyle={{
                background: appColors.backgroundAlt,
                border: `1px solid ${appColors.surfaceCardBorder}`,
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: appColors.textMuted }}
              formatter={(value: any) => [`${formatSecondsAsPace(Number(value))}/km`, ""]}
            />
            <Line
              type="monotone"
              dataKey="paceSec"
              stroke={appColors.chartRun}
              strokeWidth={2}
              dot={{ r: 3, fill: appColors.chartRun }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ─── COMPARISON PANEL ─── */

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

      <PaceTrendChart activities={activities} />

      <div>
        {activities.map((a) => {
          const pace = formatPaceFromSpeed(a.average_speed_mps);
          const hr =
            a.avg_hr_bpm != null && Number(a.avg_hr_bpm) > 0
              ? `${Math.round(Number(a.avg_hr_bpm))} bpm`
              : null;

          return (
            <div
              key={a.activity_id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 16px",
                borderTop: `1px solid ${appColors.divider}`,
                gap: 12,
              }}
            >
              <span style={{ fontSize: 13, color: appColors.textMuted, flexShrink: 0 }}>
                {fmtShortDate(a.updated_at)}
              </span>

              <div
                style={{
                  display: "flex",
                  gap: 12,
                  alignItems: "baseline",
                  flexWrap: "wrap",
                  justifyContent: "flex-end",
                }}
              >
                {a.moving_time_s != null && (
                  <span style={{ fontSize: 14, fontWeight: 700, color: appColors.textPrimary }}>
                    {fmtSecondsHMS(a.moving_time_s)}
                  </span>
                )}
                {pace && (
                  <span style={{ fontSize: 12, color: appColors.textMuted }}>{pace}</span>
                )}
                {hr && (
                  <span style={{ fontSize: 12, color: appColors.textMuted }}>❤️ {hr}</span>
                )}
                {a.elevation_gain_m != null && a.elevation_gain_m > 0 && (
                  <span style={{ fontSize: 12, color: appColors.textMuted }}>
                    ↗ {Math.round(a.elevation_gain_m)} m
                  </span>
                )}
              </div>
            </div>
          );
        })}
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