// src/app/features/activities/components/ActivityTable.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  NO_X_OVERFLOW,
  PANEL_PAD,
  PANEL_INNER_STACK,
  PANEL_HEADER,
  PANEL_TITLE,
  PANEL_PREVIEW,
  PANEL_LIST,
  PANEL_SURFACE,
  PANEL_SURFACE_STYLE,
} from "@/app/shared/ui/tokens";

import { useActivityData } from "@/app/shared/components/dataProviders/ActivityDataProvider";
import type {
  ActivityRow,
  ComponentVariant,
} from "@/app/features/activities/types/activities";
import {
  normSportsList,
  toEffSport,
} from "@/app/features/activities/utils/activity";
import { prettySkDate, fmtSecondsHMS } from "@/app/shared/utils/time";
import { useT } from "@/app/shared/i18n/useT";

import SessionCard, { type SessionItem } from "@/app/shared/components/session/SessionCard";
import { useSettings } from "@/app/shared/i18n/SettingsProvider";
import { useCoachData } from "@/app/shared/components/dataProviders/CoachDataProvider";

type Props = {
  start?: string;
  end?: string;
  sport?: string | string[] | null;
  allowedSports?: string[] | null;
  titleOverride?: string;
  variant?: ComponentVariant; 
  suppressItemHeaderIfSingleDay?: boolean;
  autoOpenActivityId?: number;
};

export default function ActivityTable({
  start,
  end,
  sport = "all",
  allowedSports = null,
  titleOverride,
  variant = "activity",
  suppressItemHeaderIfSingleDay = false,
  autoOpenActivityId,
}: Props) {
  const { selectByRange, rows: allRows } = useActivityData();
  const { refresh: refreshCoach } = useCoachData(); // 1. Prístup k refreshu trénera
  const { settings } = useSettings() as any;
  const showAdvanced = settings?.show_advanced ?? false;

  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(false);

  const singleDay = !!start && !!end && start === end;
  const t = useT();

  const headerTitle = useMemo(() => {
    if (titleOverride) return titleOverride;

    if (start && end) {
      const sd = singleDay
        ? `${t("activityTable.activities")} — ${prettySkDate(start)}`
        : `${t("activityTable.week")} ${start} → ${end}`;
      return sd;
    }

    return t("activityTable.history");
  }, [start, end, titleOverride, singleDay, t]);

  const sportList = useMemo(() => normSportsList(sport), [sport]);

  useEffect(() => {
    if (!start || !end) {
      setRows([]);
      return;
    }

    setLoading(true);

    const inRange = selectByRange(start, end);

    const afterWhitelist =
      Array.isArray(allowedSports) && allowedSports.length
        ? inRange.filter((r) => allowedSports.includes(toEffSport(r)))
        : inRange;

    const finalRows = sportList
      ? afterWhitelist.filter((r) => sportList.includes(toEffSport(r)))
      : afterWhitelist;

    setRows(finalRows);
    setLoading(false);
  }, [start, end, sportList, allowedSports, selectByRange, allRows.length]);

  return (
    <div
      className={[PANEL_SURFACE, PANEL_PAD, PANEL_INNER_STACK].join(" ")}
      style={PANEL_SURFACE_STYLE}
    >
      <div className={PANEL_HEADER}>
        <h2 className={PANEL_TITLE}>{headerTitle}</h2>
      </div>

      {loading && <div className={PANEL_PREVIEW}>{t("common.loading")}</div>}

      {!loading && rows.length === 0 && (
        <div className={PANEL_PREVIEW}>{t("activityTable.noActivities")}</div>
      )}

      {!loading && rows.length > 0 && (
        <ul className={[PANEL_LIST, NO_X_OVERFLOW].join(" ")}>
          {rows.map((r) => {
            const eff = toEffSport(r);
            const iso = r.date.slice(0, 10);

            const dur =
              r.moving_time_s != null ? fmtSecondsHMS(r.moving_time_s) : null;

            const dist =
              r.distance_m != null
                ? `${((r.distance_m || 0) / 1000).toFixed(2)} km`
                : null;

            const isFocused =
              autoOpenActivityId != null &&
              Number(r.activity_id) === Number(autoOpenActivityId);

            const hideDateLine =
              variant === "calendar" ||
              (suppressItemHeaderIfSingleDay && singleDay);

            // 🌟 kind: "session" (zjednotený model) - planId zostáva null,
            // SessionCard si ho sám dotiahne cez apiGetPlanByActivityId ak existuje
            // (napr. ak bola táto aktivita napárovaná na plán z kalendára).
            const item: SessionItem = {
              id: r.activity_id,
              kind: "session",
              title: r.name || t("activityTable.activities"),
              dateIso: iso,
              sport: eff,
              planId: null,
              activityId: Number(r.activity_id),

              timeStr: dur,
              distanceStr: dist,
              avgHr: r.average_heartrate_bpm ?? null,
              maxHr: r.max_heartrate_bpm ?? null,

              defaultOpen: isFocused,
              hideDateLine,
            };

            return (
              <li key={`${r.activity_id}-${isFocused ? "open" : "closed"}`}>
                <SessionCard
                  variant={variant === "calendar" ? "calendar" : "activity"}
                  showAdvanced={showAdvanced}
                  // 2. Refresh trénera, ak sa s aktivitou niečo udeje (napr. zmazanie recenzie alebo v budúcnosti unmatch)
                  onRefreshPlan={() => refreshCoach()}
                  item={item}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}