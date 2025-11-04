"use client";

import { useEffect, useMemo, useState } from "react";
import { CARD } from "@/shared/ui/classes";
import { useActivityData } from "@/shared/components/dataProviders/ActivityDataProvider";
import { ActivityRow } from "@/features/activity/utils/activity";
import ActivityDetail from "@/shared/components/ActivityDetail";
import { toEffSport } from "@/features/activity/utils/sport";
import { fmtSecondsHMS } from "@/shared/utils/format";
import CommonActivityCard from "@/shared/components/CommonActivityCard";

/* ---------------- helpers ---------------- */

function normSportsList(
  sel: string | string[] | null | undefined
): string[] | null {
  if (sel == null) return null;
  if (Array.isArray(sel)) {
    const arr = sel.map((s) => String(s).trim().toLowerCase()).filter(Boolean);
    if (arr.length === 0) return null;
    if (arr.length === 1 && arr[0] === "all") return null;
    return Array.from(new Set(arr));
  }
  const raw = String(sel).trim().toLowerCase();
  if (!raw || raw === "all") return null;
  const arr = raw.split(",").map((s) => s.trim()).filter(Boolean);
  return arr.length ? Array.from(new Set(arr)) : null;
}

function prettySkDate(iso: string) {
  const d = new Date(iso);
  const day = d.toLocaleDateString("sk-SK", { day: "2-digit", month: "2-digit", year: "numeric" });
  const wk = d.toLocaleDateString("sk-SK", { weekday: "short" });
  return `${wk} · ${day}`;
}

/* ---------------- props ---------------- */

type Props = {
  start?: string;
  end?: string;
  sport?: string | string[] | null;
  allowedSports?: string[] | null;
  titleOverride?: string;

  /** Layout režim: "page" = bežný zoznam; "calendar" = pod kalendárom (tesnejší) */
  variant?: "page" | "calendar";

  /** Skryť hlavičku dátumu v každej karte, keď zobrazujeme 1 deň (duplicitné s titulkom nad tab.) */
  suppressItemHeaderIfSingleDay?: boolean;
};

export default function ActivityTable({
  start,
  end,
  sport = "all",
  allowedSports = null,
  titleOverride,
  variant = "page",
  suppressItemHeaderIfSingleDay = false,
}: Props) {
  const { selectByRange, rows: allRows } = useActivityData();
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(false);

  const singleDay = start && end && start === end;

  const headerTitle = useMemo(() => {
    if (titleOverride) return titleOverride;
    if (start && end) {
      return singleDay ? `Aktivity — ${prettySkDate(start)}` : `Týždeň ${start} → ${end}`;
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

    const finalRows = sportList ? afterWhitelist.filter((r) => sportList.includes(toEffSport(r))) : afterWhitelist;

    setRows(finalRows);
    setLoading(false);
  }, [start, end, sportList, allowedSports, selectByRange, allRows.length]);

  // layout triedy – jemne iné odsadenia pre kalendár
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
        <div className="opacity-70 py-4 text-sm">Žiadne aktivity v zadanom období.</div>
      )}

      {!loading && rows.length > 0 && (
        <ul className="space-y-3 pb-1">
          {rows.map((r) => {
            const eff = toEffSport(r);
            const iso = r.date.slice(0, 10);
            const dateStr = prettySkDate(iso);
            const dur = r.moving_time_s != null ? fmtSecondsHMS(r.moving_time_s) : null;
            const dist =
              r.distance_m != null
                ? `${((r.distance_m || 0) / 1000).toFixed(2)} km`
                : null;

            const metaCollapsed = [
              dur ? `Time ${dur}` : null,
              dist ? `Distance ${dist}` : null,
              r.average_heartrate_bpm != null ? `Avg HR ${r.average_heartrate_bpm}` : null,
              r.max_heartrate_bpm != null ? `Max HR ${r.max_heartrate_bpm}` : null,
            ];

            const headerLeft = suppressItemHeaderIfSingleDay && singleDay ? " " : dateStr;

            return (
              <li key={r.activity_id} className="px-0">
                <CommonActivityCard
                  id={`act-${r.activity_id}`}
                  headerLeft={headerLeft}
                  sportKind={eff}
                  title={r.name || "Activity"}
                  subtitle={null}
                  meta={metaCollapsed}
                  defaultOpen={false}
                  hideSubtitleWhenOpen
                  hideMetaWhenOpen
                >
                  {/* ⬇️ DETAIL BEZ VNÚTORNEJ „KARTY“ – lícuje s bokmi aj spodkom, len mierne odsadenie zhora */}
                  <div className="mt-2">
                    <ActivityDetail
                      activityId={r.activity_id}
                      inline
                      compact
                      showHeader={false}
                    />
                  </div>
                </CommonActivityCard>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}