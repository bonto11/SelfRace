"use client";

import { useEffect, useMemo, useState } from "react";
import {
  // CARD,  <-- preč
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

import SessionCard from "@/app/shared/components/session/SessionCard";

type Props = {
  start?: string;
  end?: string;
  sport?: string | string[] | null;
  allowedSports?: string[] | null;
  titleOverride?: string;
  variant?: ComponentVariant; // "activity" | "calendar" | "pb"
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
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(false);

  const singleDay = !!start && !!end && start === end;

  const headerTitle = useMemo(() => {
    if (titleOverride) return titleOverride;

    if (start && end) {
      const t = singleDay
        ? `Aktivity — ${prettySkDate(start)}`
        : `Týždeň ${start} → ${end}`;
      return t;
    }

    return "História (vyber rozsah)";
  }, [start, end, titleOverride, singleDay]);

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
    return (
  <div
    className={[PANEL_SURFACE, PANEL_PAD, PANEL_INNER_STACK].join(" ")}
    style={PANEL_SURFACE_STYLE}
  >
      <div className={PANEL_HEADER}>
        <h2 className={PANEL_TITLE}>{headerTitle}</h2>
      </div>

      {loading && <div className={PANEL_PREVIEW}>Načítavam…</div>}

      {!loading && rows.length === 0 && (
        <div className={PANEL_PREVIEW}>Žiadne aktivity v zadanom období.</div>
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

            return (
              <li key={`${r.activity_id}-${isFocused ? "open" : "closed"}`}>
                <SessionCard
                  variant={variant === "calendar" ? "calendar" : "activity"}
                  item={{
                    id: r.activity_id,
                    kind: "activity",
                    title: r.name || "Activity",
                    dateIso: iso,
                    sport: eff,
                    activityId: Number(r.activity_id),

                    timeStr: dur,
                    distanceStr: dist,
                    avgHr: r.average_heartrate_bpm ?? null,
                    maxHr: r.max_heartrate_bpm ?? null,

                    defaultOpen: isFocused,
                    hideDateLine,
                  }}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}