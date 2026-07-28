// src/app/shared/components/widgets/WidgetLastActivity.tsx
"use client";

import { useEffect, useState } from "react";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import SportBadge from "@/app/shared/ui/components/SportBadge";
import { useUserId } from "@/app/shared/hooks/useUserId";
import {
  apiGetLastActivityBundle,
  type ActivityBundle,
} from "@/app/features/activities/api/analytics_activities";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { WIDGET_LOADING_WRAP, WIDGET_EMPTY } from "@/app/shared/ui/tokens";
import { useT } from "@/app/shared/i18n/useT";

function prettySkDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("sk-SK", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

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
 * Widget poslednej aktivity — teraz cez /analytics/lastActivity bundle
 * (summary+enrichment+streams+laps+splits), nie starý apiFetchRange.
 * Obsah zatiaľ: sport badge, dátum, názov, vzdialenosť (ak je), trvanie.
 */
export default function WidgetLastActivity({ onOpenDetail }: Props) {
  const { userId } = useUserId();
  const t = useT();
  const [loading, setLoading] = useState(true);
  const [bundle, setBundle] = useState<ActivityBundle | null>(null);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    apiGetLastActivityBundle(userId)
      .then((b) => {
        if (alive) setBundle(b);
      })
      .catch((e) => console.error("[WidgetLastActivity]", e))
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [userId]);

  const s = bundle?.summary ?? null;
  const activityId = s?.activity_id ?? null;
  const sport = s?.sport_type_ovrd ?? s?.sport_type_fe ?? s?.sport_type ?? null;
  const distanceStr = formatDistance(s?.distance_m);
  const durationStr = formatDuration(s?.moving_time_s ?? s?.elapsed_time_s);

  return (
    <WidgetCard
      title={t("activities.lastActivity.title" as any) || "Posledná aktivita"}
      tooltip={t("activities.lastActivity.tooltip" as any) || undefined}
      accent="none"
      onOpen={activityId != null ? () => onOpenDetail?.(activityId) : undefined}
      interactive={!!onOpenDetail && activityId != null}
      minH={160}
    >
      {loading ? (
        <div className={WIDGET_LOADING_WRAP}>
          <LoadingSpinner size="widget" />
        </div>
      ) : !s ? (
        <p className={WIDGET_EMPTY}>
          {t("activities.lastActivity.empty" as any) || "Zatiaľ žiadna aktivita."}
        </p>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            {sport && <SportBadge sport={sport as any} />}
            <span style={{ fontSize: 11, color: appColors.textMuted }}>
              {prettySkDate(s.date)}
            </span>
          </div>

          <p style={{ fontSize: 15, fontWeight: 600, marginTop: 6, lineHeight: 1.3 }}>
            {s.name || "—"}
          </p>

          <div style={{ display: "flex", gap: 14, marginTop: 8 }}>
            {distanceStr && (
              <div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{distanceStr}</div>
                <div style={{ fontSize: 10, color: appColors.textMuted }}>
                  {t("sessions.card.distance" as any) || "Vzdialenosť"}
                </div>
              </div>
            )}
            {durationStr && (
              <div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{durationStr}</div>
                <div style={{ fontSize: 10, color: appColors.textMuted }}>
                  {t("sessions.card.time" as any) || "Trvanie"}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </WidgetCard>
  );
}
