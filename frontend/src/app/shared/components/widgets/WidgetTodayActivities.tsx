// src/app/shared/components/widgets/WidgetTodayActivities.tsx
"use client";

import { useEffect, useState } from "react";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import SportBadge from "@/app/shared/ui/components/SportBadge";
import { useUserId } from "@/app/shared/hooks/useUserId";
import {
  apiGetTodayActivitiesBundle,
  type ActivityBundle,
} from "@/app/features/activities/api/analytics_activities";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { WIDGET_LOADING_WRAP, WIDGET_EMPTY } from "@/app/shared/ui/tokens";
import { useT } from "@/app/shared/i18n/useT";

function formatDuration(s?: number | null): string | null {
  if (!s) return null;
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return h > 0 ? `${h}:${String(m).padStart(2, "0")} h` : `${m} min`;
}

function formatDistance(m?: number | null): string | null {
  if (!m) return null;
  const km = m / 1000;
  return `${km.toFixed(km < 10 ? 2 : 1)} km`;
}

type Props = {
  onOpenDetail?: (activityId: number) => void;
};

/**
 * Zoznam všetkých aktivít z DNEŠNÉHO dňa. Na rozdiel od WidgetLastActivity
 * môže obsahovať viac riadkov naraz -> celá karta nie je jeden klikací
 * celok, každý riadok je klikací zvlášť (vlastné activityId).
 */
export default function WidgetTodayActivities({ onOpenDetail }: Props) {
  const { userId } = useUserId();
  const t = useT();
  const [loading, setLoading] = useState(true);
  const [bundles, setBundles] = useState<ActivityBundle[]>([]);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    apiGetTodayActivitiesBundle(userId)
      .then((rows) => {
        if (alive) setBundles(rows);
      })
      .catch((e) => console.error("[WidgetTodayActivities]", e))
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [userId]);

  return (
    <WidgetCard
      title={t("activities.today.title" as any) || "Dnešné aktivity"}
      tooltip={t("activities.today.tooltip" as any) || undefined}
      accent="none"
      minH={160}
    >
      {loading ? (
        <div className={WIDGET_LOADING_WRAP}>
          <LoadingSpinner size="widget" />
        </div>
      ) : bundles.length === 0 ? (
        <p className={WIDGET_EMPTY}>
          {t("activities.today.empty" as any) || "Dnes zatiaľ žiadna aktivita."}
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
          {bundles.map((b) => {
            const s = b.summary;
            if (!s) return null;
            const sport = s.sport_type_ovrd ?? s.sport_type_fe ?? s.sport_type ?? null;
            const distanceStr = formatDistance(s.distance_m);
            const durationStr = formatDuration(s.moving_time_s ?? s.elapsed_time_s);

            return (
              <button
                key={s.activity_id}
                type="button"
                onClick={() => onOpenDetail?.(s.activity_id)}
                disabled={!onOpenDetail}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  width: "100%",
                  textAlign: "left",
                  padding: "6px 8px",
                  borderRadius: 10,
                  background: appColors.backgroundAlt,
                  border: `1px solid ${appColors.surfaceCardBorder}`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  {sport && <SportBadge sport={sport as any} />}
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {s.name || "—"}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: appColors.textMuted, whiteSpace: "nowrap" }}>
                  {[distanceStr, durationStr].filter(Boolean).join(" · ")}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </WidgetCard>
  );
}
