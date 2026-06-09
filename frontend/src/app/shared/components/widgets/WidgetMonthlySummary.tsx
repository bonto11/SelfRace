// src/app/shared/components/widgets/WidgetMonthlySummary.tsx
"use client";

import { useEffect, useState } from "react";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { useUserId } from "@/app/shared/hooks/useUserId";
import {
  apiGetMonthlySummary,
  type MonthlySummary,
} from "@/app/features/activities/api/monthly_summary";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import {
  WIDGET_LOADING_WRAP,
  WIDGET_VALUE_ROW,
  WIDGET_VALUE_PRIMARY,
  WIDGET_VALUE_UNIT,
  WIDGET_NOTE,
} from "@/app/shared/ui/tokens";
import { useT } from "@/app/shared/i18n/useT";

function fmtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}min`;
  if (h > 0) return `${h}h`;
  return `${m}min`;
}
function fmtDist(meters: number): string {
  const km = meters / 1000;
  return km >= 10 ? `${Math.round(km)} km` : `${km.toFixed(1)} km`;
}

/* ─── Malý sport badge ─── */
const SPORT_ICON: Record<string, string> = {
  run: "🏃", ride: "🚴", swim: "🏊", strength: "💪", mixed: "⚡", walk: "🚶", other: "▪",
};
const SPORT_ORDER = ["run", "ride", "swim", "mixed", "strength", "walk", "other"];

function SportPill({ sport, timeS, distM }: { sport: string; timeS: number; distM?: number | null }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
      padding: "6px 8px", borderRadius: 8,
      backgroundColor: "rgba(255,255,255,0.05)",
      minWidth: 52,
    }}>
      <span style={{ fontSize: 15 }}>{SPORT_ICON[sport] ?? "▪"}</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: appColors.textPrimary }}>
        {fmtTime(timeS)}
      </span>
      {distM != null && distM > 0 && (
        <span style={{ fontSize: 10, color: appColors.textMuted }}>
          {fmtDist(distM)}
        </span>
      )}
    </div>
  );
}

/* ─── WIDGET ─── */
export default function WidgetMonthlySummary({ onOpenDetail }: { onOpenDetail?: () => void }) {
  const { userId } = useUserId();
  const t = useT();

  const now = new Date();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<MonthlySummary | null>(null);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    apiGetMonthlySummary(userId, now.getFullYear(), now.getMonth() + 1)
      .then((d) => { if (alive) setData(d); })
      .catch((e) => console.error("[WidgetMonthlySummary]", e))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [userId]);

  const sports = SPORT_ORDER
    .filter((s) => data?.sport_stats[s] && data.sport_stats[s].total_time_s > 0)
    .map((s) => ({ sport: s, ...data!.sport_stats[s] }));

  const HAS_DIST = new Set(["run", "ride", "swim", "mixed"]);

  return (
    <WidgetCard
      title={t("monthlySummary.widget.title") as any}
      tooltip={t("monthlySummary.widget.tooltip") as any}
      onOpen={onOpenDetail}
      interactive={!!onOpenDetail}
      minH={160}
    >
      {loading ? (
        <div className={WIDGET_LOADING_WRAP}><LoadingSpinner size="widget" /></div>
      ) : !data || data.summary.total_sessions === 0 ? (
        <p style={{ fontSize: 13, color: appColors.textMuted }}>
          {t("monthlySummary.noData") as any}
        </p>
      ) : (
        <>
          {/* Hlavné číslo — celkový čas */}
          <div className={WIDGET_VALUE_ROW} style={{ alignItems: "baseline", gap: 6 }}>
            <span className={WIDGET_VALUE_PRIMARY}>
              {fmtTime(data.summary.total_time_s)}
            </span>
            {data.summary.total_dist_m > 0 && (
              <span className={WIDGET_VALUE_UNIT}>
                {fmtDist(data.summary.total_dist_m)}
              </span>
            )}
          </div>

          {/* Počet sessionov */}
          <p className={WIDGET_NOTE}>
            {data.summary.total_sessions} {t("monthlySummary.widget.sessions") as any}
          </p>

          {/* Sport pills */}
          {sports.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {sports.map(({ sport, total_time_s, total_dist_m }) => (
                <SportPill
                  key={sport}
                  sport={sport}
                  timeS={total_time_s}
                  distM={HAS_DIST.has(sport) ? total_dist_m : null}
                />
              ))}
            </div>
          )}
        </>
      )}
    </WidgetCard>
  );
}