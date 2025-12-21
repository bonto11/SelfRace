"use client";

import { useEffect, useMemo, useState } from "react";
import { CARD, NO_X_OVERFLOW } from "@/shared/ui/classes";
import { useActivityData } from "@/shared/components/dataProviders/ActivityDataProvider";
import {
  ActivityRow,
  ComponentVariant,
} from "@/features/activities/types/activities";
import {
  prettySkDate,
  normSportsList,
} from "@/features/activities/utils/activity";
import { toEffSport } from "@/features/activities/utils/sport";
import { fmtSecondsHMS } from "@/shared/utils/time";

import SessionCard from "@/shared/components/SessionCard";

/* props */
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
    if (start && end)
      return singleDay
        ? `Aktivity — ${prettySkDate(start)}`
        : `Týždeň ${start} → ${end}`;
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

  // layout – konzistentné povrchy a paddingy z classes
  const wrapperCls = [
    CARD,
    "space-y-4",
    variant === "calendar" ? "p-3 md:p-4" : "p-4 md:p-5",
  ].join(" ");

  const headerCls = [
    "flex justify-between items-center",
    variant === "calendar" ? "mb-1" : "mb-2",
  ].join(" ");

  return (
    <div className={wrapperCls}>
      <div className={headerCls}>
        <h2 className="text-lg font-bold">{headerTitle}</h2>
      </div>

      {loading && <div className="opacity-70 py-4">Načítavam…</div>}

      {!loading && rows.length === 0 && (
        <div className="opacity-70 py-4 text-sm">
          Žiadne aktivity v zadanom období.
        </div>
      )}

      {!loading && rows.length > 0 && (
        <ul className={["space-y-3 pb-1", NO_X_OVERFLOW].join(" ")}>
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

            return (
              <li
                key={`${r.activity_id}-${isFocused ? "open" : "closed"}`}
                className="px-0"
              >
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
                    hideDateLine: variant === "calendar", // kalendár = dátum často rieši header mimo itemu
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
