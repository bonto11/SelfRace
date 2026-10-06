"use client";

import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import { CalendarDays } from "lucide-react";
import { useActivityData } from "@/app/shared/components/dataProviders/ActivityDataProvider";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { useT } from "@/app/shared/i18n/useT";
import { IconTile, ListRow, SportTile, WidgetLoading } from "@/app/shared/ui/widget/WidgetParts";
import { activityInfo } from "@/app/features/activities/utils/activityInfo";

function formatDuration(s?: number | null): string | null {
  if (!s) return null;
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return h > 0 ? `${h} h ${String(m).padStart(2, "0")} min` : `${m} min`;
}

function formatDistance(m?: number | null): string | null {
  if (!m) return null;
  const km = m / 1000;
  return `${km.toFixed(1)} km`;
}

type Props = {
  onOpenDetail?: (activityId: number) => void;
};

export default function WidgetTodayActivities({ onOpenDetail }: Props) {
  // dnešné aktivity sú už v načítanom rozsahu providera - netreba extra
  // request (ten ťahal aj streams/laps, ktoré widget nepotrebuje)
  const { todayRows, rowsLoaded } = useActivityData();
  const t = useT();
  const loading = !rowsLoaded;

  return (
    <WidgetCard
      title={t("todayActivities.title")}
      tooltip={activityInfo(t, "today")}
      accent="none"
      minH={160}
    >
      {loading ? (
        <WidgetLoading />
      ) : todayRows.length === 0 ? (
        <div className="flex items-center gap-2.5">
          <IconTile icon={CalendarDays} color={appColors.textMuted} />
          <p className="text-sm" style={{ color: appColors.textMuted }}>{t("todayActivities.empty")}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {todayRows.map((s) => {
            const sport = s.sport_type_ovrd ?? s.sport_type_fe ?? s.sport_type ?? null;
            const meta = [formatDistance(s.distance_m), formatDuration(s.moving_time_s ?? s.elapsed_time_s)]
              .filter(Boolean)
              .join(" · ");
            return (
              <ListRow
                key={s.activity_id}
                icon={<SportTile sport={sport} />}
                label={s.name || "—"}
                value={meta || undefined}
                onClick={onOpenDetail ? () => onOpenDetail(s.activity_id) : undefined}
              />
            );
          })}
        </div>
      )}
    </WidgetCard>
  );
}
