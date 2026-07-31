// src/app/features/activities/components/DetailRouteMatch.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ComposedChart,
  Line,
  Area,
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
import { CARD, SURFACE_CARD_STYLE, CHART_HR } from "@/app/shared/ui/tokens";
import {
  apiGetRouteOverview,
  apiCompareRouteMatch,
  type RouteOverviewEntry,
  type RouteMatchComparison,
} from "@/app/features/activities/api/activities_enrichment";
import { apiFetchActivityStreams } from "@/app/features/activities/api/analytics_activities";
import {
  resampleStreamByDistance,
  resampleByElevationMatch,
  shouldUseElevationAlignment,
  mergeSeriesForChart,
  average,
  diagnoseStream,
  type ResampledSeries,
} from "@/app/features/activities/utils/routeStreamCompare";
import { fmtSecondsHMS } from "@/app/shared/utils/time";
import { formatDistance } from "@/app/shared/utils/distance";

const SPORT_ICON: Record<string, string> = {
  run: "🏃",
  ride: "🚴",
  swim: "🏊",
};

const LINE_COLORS = [appColors.chartRun, appColors.chartBike];

const MAX_OVERLAY_ACTIVITIES = 2;


/* ─── HELPERS ─── */

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

/* ─── LEGENDA (klikateľná - zapnúť/vypnúť krivku) ─── */

function RunLegend({
  labels,
  visible,
  onToggle,
}: {
  labels: string[];
  visible: boolean[];
  onToggle: (idx: number) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 12, padding: "0 16px 8px", flexWrap: "wrap" }}>
      {labels.map((label, idx) => (
        <button
          key={idx}
          type="button"
          onClick={() => onToggle(idx)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            background: "transparent",
            border: "none",
            padding: "3px 6px",
            borderRadius: 6,
            cursor: "pointer",
            opacity: visible[idx] ? 1 : 0.35,
          }}
        >
          <span
            style={{
              width: 10,
              height: 2,
              background: LINE_COLORS[idx % LINE_COLORS.length],
              display: "inline-block",
            }}
          />
          <span style={{ fontSize: 11, color: appColors.textMuted }}>{label}</span>
        </button>
      ))}
    </div>
  );
}

/* ─── OVERLAY CHART (jeden metrický graf, N kriviek podľa vzdialenosti) ─── */

function OverlayChart({
  title,
  data,
  dataKeyPrefix,
  reversedY,
  valueFormatter,
  activityCount,
  areaFill,
  visible,
}: {
  title: string;
  data: Record<string, any>[];
  dataKeyPrefix: "hr" | "pace" | "elevation";
  reversedY?: boolean;
  valueFormatter: (v: number) => string;
  activityCount: number;
  areaFill?: boolean;
  visible: boolean[];
}) {
  const hasAnyData = data.some((row) =>
    Array.from({ length: activityCount }).some(
      (_, idx) => row[`${dataKeyPrefix}_${idx}`] != null,
    ),
  );
  if (!hasAnyData) return null;

  return (
    <div style={{ padding: "8px 16px 12px" }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          color: appColors.textMuted,
          marginBottom: 6,
        }}
      >
        {title}
      </div>
      <div style={{ width: "100%", height: 130 }}>
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={appColors.divider} vertical={false} />
            <XAxis
              dataKey="distanceKm"
              type="number"
              domain={["dataMin", "dataMax"]}
              tick={{ fontSize: 10, fill: appColors.textMuted }}
              axisLine={{ stroke: appColors.divider }}
              tickLine={false}
              tickFormatter={(v) => `${v} km`}
            />
            <YAxis
              reversed={reversedY}
              tick={{ fontSize: 10, fill: appColors.textMuted }}
              axisLine={false}
              tickLine={false}
              width={40}
              tickFormatter={(v) => valueFormatter(v)}
            />
            <Tooltip
              contentStyle={{
                background: appColors.backgroundAlt,
                border: `1px solid ${appColors.surfaceCardBorder}`,
                borderRadius: 8,
                fontSize: 12,
              }}
              labelFormatter={(v) => `${v} km`}
              formatter={(value: any) => [valueFormatter(Number(value)), ""]}
            />
            {Array.from({ length: activityCount }).map((_, idx) => {
              if (!visible[idx]) return null;
              return areaFill ? (
                <Area
                  key={idx}
                  type="monotone"
                  dataKey={`${dataKeyPrefix}_${idx}`}
                  stroke={LINE_COLORS[idx % LINE_COLORS.length]}
                  fill={LINE_COLORS[idx % LINE_COLORS.length]}
                  fillOpacity={0.08}
                  strokeWidth={1.5}
                  connectNulls
                  dot={false}
                  isAnimationActive={false}
                />
              ) : (
                <Line
                  key={idx}
                  type="monotone"
                  dataKey={`${dataKeyPrefix}_${idx}`}
                  stroke={LINE_COLORS[idx % LINE_COLORS.length]}
                  strokeWidth={2}
                  connectNulls
                  dot={false}
                  isAnimationActive={false}
                />
              );
            })}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ─── SUMÁR ZMENY (posledny vs predposledny beh) ─── */

function ChangeSummary({
  currentLabel,
  previousLabel,
  currentPaceSec,
  previousPaceSec,
  currentHr,
  previousHr,
}: {
  currentLabel: string;
  previousLabel: string;
  currentPaceSec: number | null;
  previousPaceSec: number | null;
  currentHr: number | null;
  previousHr: number | null;
}) {
  const t = useT();

  if (currentPaceSec == null && currentHr == null) return null;

  const paceDiff =
    currentPaceSec != null && previousPaceSec != null ? currentPaceSec - previousPaceSec : null;
  const hrDiff = currentHr != null && previousHr != null ? currentHr - previousHr : null;

  const paceIsBetter = paceDiff != null && paceDiff < 0;
  const hrIsBetter = hrDiff != null && hrDiff < 0;

  return (
    <div style={{ padding: "0 16px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
      {previousPaceSec != null && currentPaceSec != null && (
        <div
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            background: appColors.backgroundAlt,
            border: `1px solid ${appColors.surfaceCardBorder}`,
          }}
        >
          <div style={{ fontSize: 10, color: appColors.textMuted, textTransform: "uppercase" }}>
            {t("sessions.routeMatch.paceChange")}
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 3 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: appColors.textMuted }}>
              {formatSecondsAsPace(previousPaceSec)}
            </span>
            <span style={{ fontSize: 13, color: appColors.textMuted }}>→</span>
            <span style={{ fontSize: 17, fontWeight: 800, color: appColors.textPrimary }}>
              {formatSecondsAsPace(currentPaceSec)}
            </span>
            <span style={{ fontSize: 12, color: appColors.textMuted }}>/km</span>
          </div>
          {paceDiff != null && (
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: paceIsBetter ? "#4ade80" : "#f87171",
                marginTop: 3,
              }}
            >
              {paceDiff < 0 ? "−" : "+"}
              {formatSecondsAsPace(Math.abs(paceDiff))} /km
            </div>
          )}
        </div>
      )}

      {previousHr != null && currentHr != null && (
        <div
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            background: appColors.backgroundAlt,
            border: `1px solid ${appColors.surfaceCardBorder}`,
          }}
        >
          <div style={{ fontSize: 10, color: appColors.textMuted, textTransform: "uppercase" }}>
            {t("sessions.routeMatch.hrChange")}
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 3 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: appColors.textMuted }}>
              {Math.round(previousHr)}
            </span>
            <span style={{ fontSize: 13, color: appColors.textMuted }}>→</span>
            <span style={{ fontSize: 17, fontWeight: 800, color: appColors.textPrimary }}>
              {Math.round(currentHr)}
            </span>
            <span style={{ fontSize: 12, color: appColors.textMuted }}>bpm</span>
          </div>
          {hrDiff != null && (
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: hrIsBetter ? "#4ade80" : "#f87171",
                marginTop: 3,
              }}
            >
              {hrDiff < 0 ? "−" : "+"}
              {Math.round(Math.abs(hrDiff))} bpm
            </div>
          )}
        </div>
      )}

      <div style={{ fontSize: 11, color: appColors.textMuted }}>
        {previousLabel} → {currentLabel}
      </div>
    </div>
  );
}

/* ─── COMPARISON PANEL ─── */

function ComparisonPanel({
  comparison,
  userId,
}: {
  comparison: RouteMatchComparison;
  userId: number;
}) {
  const t = useT();
  const { activities, stats } = comparison;

  const [overlaySeries, setOverlaySeries] = useState<ResampledSeries[][] | null>(null);
  const [overlayLoading, setOverlayLoading] = useState(false);
  const [overlayWarnings, setOverlayWarnings] = useState<string[]>([]);

  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  useEffect(() => {
    // Defaultne posledné 2 (activities už prichádzajú zoradené od najnovšej)
    const defaults = activities.slice(0, MAX_OVERLAY_ACTIVITIES).map((a) => a.activity_id);
    setSelectedIds(defaults);
  }, [activities]);

  const toggleSelected = (activityId: number) => {
    setSelectedIds((prev) => {
      let next: number[];
      if (prev.includes(activityId)) {
        next = prev.filter((id) => id !== activityId);
      } else if (prev.length >= MAX_OVERLAY_ACTIVITIES) {
        next = [...prev.slice(1), activityId];
      } else {
        next = [...prev, activityId];
      }
      return next;
    });
  };

  const targetActivities = useMemo(
    () =>
      activities
        .filter((a) => selectedIds.includes(a.activity_id))
        .sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? "")),
    [activities, selectedIds],
  );

  useEffect(() => {
    let alive = true;

    if (targetActivities.length < 2) {
      setOverlaySeries(null);
      setOverlayWarnings([]);
      return;
    }

    setOverlayLoading(true);
    setOverlayWarnings([]);

    Promise.all(
      targetActivities.map((a) =>
        apiFetchActivityStreams(userId, a.activity_id, true)
          .then((r) => {
            return r;
          })
          .catch((e) => {
            console.error(`[RouteCompare] fetch FAILED activity_id=${a.activity_id}`, e);
            return null;
          }),
      ),
    )
      .then((results) => {
        if (!alive) {
          return;
        }

        const rawStreamsList = results.map((r) => r?.streams ?? null);

        // Diagnostika: pre každú aktivitu presne vieme, PREČO chýbajú dáta,
        // namiesto toho aby krivka len ticho zmizla z grafu.
        const warnings: string[] = [];
        rawStreamsList.forEach((s, idx) => {
          const diag = diagnoseStream(s);
          if (!diag.ok) {
            const label = fmtShortDate(targetActivities[idx]?.updated_at ?? null);
            const reasonText =
              diag.reason === "no_streams"
                ? t("sessions.routeMatch.errNoStreams")
                : diag.reason === "no_distance"
                  ? t("sessions.routeMatch.errNoDistance")
                  : t("sessions.routeMatch.errPartialDistance");
            warnings.push(`${label}: ${reasonText}`);
            // eslint-disable-next-line no-console
            console.warn(
              `[RouteCompare] aktivita ${targetActivities[idx]?.activity_id} (${label}) - ${diag.reason}`,
              s,
            );
          }
        });
        setOverlayWarnings(warnings);

        // Elevation-zarovnané porovnanie len pri presne 2 aktivitách a keď
        // referenčná (najnovšia) trať má dosť prevýšenia (>5 m/km, t.j. >50m
        // na 10km) - na plochých tratiach by to len pridávalo šum, tam
        // postačí jednoduché zarovnanie podľa vzdialenosti.
        if (
          rawStreamsList.length === 2 &&
          rawStreamsList[0] &&
          rawStreamsList[1] &&
          shouldUseElevationAlignment(rawStreamsList[0])
        ) {
          const { reference, matched } = resampleByElevationMatch(
            rawStreamsList[0],
            rawStreamsList[1],
          );
          setOverlaySeries([reference, matched]);
          return;
        }

        const series = rawStreamsList.map((s, idx) =>
          s
            ? resampleStreamByDistance(
                s,
                0.25,
                `activity_${targetActivities[idx]?.activity_id}`,
              )
            : [],
        );
        setOverlaySeries(series);
      })
      .finally(() => {
        if (alive) setOverlayLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [targetActivities, userId, t]);

  const chartData = useMemo(
    () => (overlaySeries ? mergeSeriesForChart(overlaySeries) : []),
    [overlaySeries],
  );

  const legendLabels = targetActivities.map((a) => fmtShortDate(a.updated_at));

  const [visible, setVisible] = useState<boolean[]>([]);
  useEffect(() => {
    setVisible(targetActivities.map(() => true));
  }, [targetActivities]);

  const toggleVisible = (idx: number) => {
    setVisible((prev) => prev.map((v, i) => (i === idx ? !v : v)));
  };

  const changeStats = useMemo(() => {
    if (!overlaySeries || overlaySeries.length < 2) return null;
    // index 0 = najnovšia (current), index 1 = predchádzajúca (previous)
    return {
      currentPaceSec: average(overlaySeries[0].map((p) => p.paceSecPerKm)),
      previousPaceSec: average(overlaySeries[1].map((p) => p.paceSecPerKm)),
      currentHr: average(overlaySeries[0].map((p) => p.hr)),
      previousHr: average(overlaySeries[1].map((p) => p.hr)),
    };
  }, [overlaySeries]);

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

      {overlayLoading && (
        <div style={{ display: "flex", justifyContent: "center", padding: 20 }}>
          <LoadingSpinner size="widget" />
        </div>
      )}

      {!overlayLoading && overlayWarnings.length > 0 && (
        <div
          style={{
            margin: "0 16px 8px",
            padding: "8px 10px",
            borderRadius: 8,
            background: "rgba(248,113,113,0.08)",
            border: "1px solid rgba(248,113,113,0.25)",
          }}
        >
          {overlayWarnings.map((w, i) => (
            <div key={i} style={{ fontSize: 12, color: "#f87171" }}>
              {w}
            </div>
          ))}
        </div>
      )}

      {!overlayLoading && overlaySeries && targetActivities.length >= 2 && (
        <>
          <RunLegend labels={legendLabels} visible={visible} onToggle={toggleVisible} />

          {changeStats && (
            <ChangeSummary
              currentLabel={legendLabels[0]}
              previousLabel={legendLabels[1]}
              currentPaceSec={changeStats.currentPaceSec}
              previousPaceSec={changeStats.previousPaceSec}
              currentHr={changeStats.currentHr}
              previousHr={changeStats.previousHr}
            />
          )}

          <OverlayChart
            title={t("sessions.routeMatch.chartHr")}
            data={chartData}
            dataKeyPrefix="hr"
            valueFormatter={(v) => `${Math.round(v)}`}
            activityCount={targetActivities.length}
            areaFill
            visible={visible}
          />
          <OverlayChart
            title={t("sessions.routeMatch.chartPace")}
            data={chartData}
            dataKeyPrefix="pace"
            reversedY
            valueFormatter={(v) => formatSecondsAsPace(v)}
            activityCount={targetActivities.length}
            visible={visible}
          />
          <OverlayChart
            title={t("sessions.routeMatch.chartElevation")}
            data={chartData}
            dataKeyPrefix="elevation"
            valueFormatter={(v) => `${Math.round(v)} m`}
            activityCount={targetActivities.length}
            areaFill
            visible={visible}
          />
        </>
      )}

      <div style={{ padding: "0 16px 4px" }}>
        <span style={{ fontSize: 11, color: appColors.textMuted }}>
          {t("sessions.routeMatch.selectTwoHint")}
        </span>
      </div>

      <div style={{ marginTop: overlaySeries ? 4 : 0 }}>
        {activities.map((a) => {
          const paceLabel =
            a.average_speed_mps != null && a.average_speed_mps > 0
              ? `${formatSecondsAsPace(1000 / a.average_speed_mps)} /km`
              : null;
          const hrLabel =
            a.avg_hr_bpm != null && Number(a.avg_hr_bpm) > 0
              ? `${Math.round(Number(a.avg_hr_bpm))} bpm`
              : null;
          const isSelected = selectedIds.includes(a.activity_id);

          return (
            <button
              key={a.activity_id}
              type="button"
              onClick={() => toggleSelected(a.activity_id)}
              className="w-full text-left"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 16px",
                borderTop: `1px solid ${appColors.divider}`,
                gap: 12,
                flexWrap: "wrap",
                background: isSelected ? appColors.surfaceCardHover : "transparent",
                border: "none",
                borderTopWidth: 1,
                borderTopStyle: "solid",
                borderTopColor: appColors.divider,
                cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 4,
                    border: `1.5px solid ${isSelected ? appColors.chartRun : appColors.surfaceCardBorder}`,
                    background: isSelected ? appColors.chartRun : "transparent",
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: 13, color: appColors.textMuted, flexShrink: 0 }}>
                  {fmtShortDate(a.updated_at)}
                </span>
              </div>
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
                {a.distance_m != null && (
                  <span style={{ fontSize: 12, color: appColors.textMuted }}>
                    {formatDistance(a.distance_m)}
                  </span>
                )}
                {paceLabel && (
                  <span style={{ fontSize: 12, color: appColors.textMuted }}>{paceLabel}</span>
                )}
                {hrLabel && (
                  <span style={{ fontSize: 12, color: appColors.textMuted }}>{hrLabel}</span>
                )}
              </div>
            </button>
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

      {!comparisonLoading && comparison && userId && (
        <ComparisonPanel comparison={comparison} userId={Number(userId)} />
      )}
    </>
  );
}