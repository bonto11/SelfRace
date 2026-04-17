// src/app/shared/components/calendar/MiniCalendar.tsx
"use client";

import * as React from "react";
import { appColors } from "@/app/shared/ui/theme/app_colors";

import { useUserId } from "@/app/shared/hooks/useUserId";
import { useActivityData } from "@/app/shared/components/dataProviders/ActivityDataProvider";
import { useCoachData } from "@/app/shared/components/dataProviders/CoachDataProvider";

import { apiGetExternalEventsWindow } from "@/app/features/coach/api/coach_external_events";
import type { ExternalEvent } from "@/app/features/coach/types/externalEvents";
import type { SportKey } from "@/app/features/calendar/types/calendarTypes";

import {
  dedupeCalendarItems,
  eventDateIso,
  type CalendarItemBase,
  type CalendarItemKind,
} from "@/app/features/calendar/utils/calendarSlots";

import {
  CAL_WIDGET_DOW_ROW,
  CAL_WIDGET_DOW_CELL,
  CAL_WIDGET_GRID,
  CAL_WIDGET_DAY_CELL,
  CAL_WIDGET_DAY_NUM,
  CAL_WIDGET_ITEMS_WRAP,
  CAL_WIDGET_DOT,
  CAL_WIDGET_PLAN_DOT,
  CAL_WIDGET_MARK,
  CAL_WIDGET_MORE,
} from "@/app/shared/ui/tokens/calendar";
import { useT } from "@/app/shared/i18n/useT";

const SPORT_COLORS: Record<string, string> = {
  run: appColors.chartRun,
  ride: appColors.chartBike,
  swim: appColors.chartSwim,
  strength: appColors.chartStrength,
  mixed: appColors.chartMixed,
  skate: appColors.chartSkate,
  walk: appColors.chartWalk,
  other: appColors.chartOther,
};

const pad2 = (n: number) => (n < 10 ? `0${n}` : String(n));
const iso = (y: number, m0: number, d: number) => `${y}-${pad2(m0 + 1)}-${pad2(d)}`;

function startOfWeek(date = new Date()) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // Po=0..Ne=6
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function safeSportKey(v: any): SportKey {
  const s = String(v || "").toLowerCase() as SportKey;
  if (s in SPORT_COLORS) return s;
  return "other";
}

type DayItem = CalendarItemBase & { id: number };

type MiniCalendarProps = {
  startFrom?: "monday" | "today";
  content?: "all" | "plan";
  perDayLimit?: number;
  onOpen?: () => void;
  // 👇 Nové props pre vyberanie konkrétneho dňa
  selectedDateIso?: string;
  onSelectDate?: (dateIso: string) => void;
};

export default function MiniCalendar({
  startFrom = "monday",
  content = "all",
  perDayLimit = 6,
  onOpen,
  selectedDateIso,
  onSelectDate,
}: MiniCalendarProps) {
  const { userId, isChecking } = useUserId();
  const { selectByRange } = useActivityData();
  const { plan } = useCoachData();
  const { selectPlanByRange } = plan;
  const t = useT();

  const startDate = React.useMemo(() => {
    if (startFrom === "today") {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return d;
    }
    return startOfWeek();
  }, [startFrom]);

  const endDate = React.useMemo(() => {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + 6);
    return d;
  }, [startDate]);

  const startIso = iso(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const endIso = iso(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());

  const [externalRows, setExternalRows] = React.useState<ExternalEvent[]>([]);

  React.useEffect(() => {
    if (!userId || isChecking || content === "plan") return;
    let alive = true;

    (async () => {
      try {
        const rows = await apiGetExternalEventsWindow(userId, startIso, endIso);
        if (alive) setExternalRows(Array.isArray(rows) ? rows : []);
      } catch (e) {
        if (alive) setExternalRows([]);
      }
    })();

    return () => {
      alive = false;
    };
  }, [userId, startIso, endIso, isChecking, content]);

  const byDay = React.useMemo(() => {
    const map = new Map<string, DayItem[]>();
    const todayIso = new Date().toISOString().slice(0, 10);

    for (let i = 0; i < 7; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      map.set(iso(d.getFullYear(), d.getMonth(), d.getDate()), []);
    }

    if (content === "all") {
      for (const ev of externalRows) {
        const k = eventDateIso(ev);
        if (!k || !map.has(k)) continue;
        const sport = safeSportKey((ev as any).sport ?? (ev as any).sport_type ?? "other");
        map.get(k)!.push({
          id: Number((ev as any).id ?? 0) || Math.floor(Math.random() * 1e9),
          sport,
          kind: "external",
          activityId: null,
        });
      }

      const actRows = selectByRange(startIso, endIso);
      for (const r of actRows as any[]) {
        const k = String(r.date ?? "").slice(0, 10);
        if (!k || !map.has(k)) continue;
        const sport = safeSportKey(r.sport ?? r.sport_type_fe ?? r.sport_type ?? "other");
        const aidRaw = r.activity_id;
        const activityId = aidRaw != null && !Number.isNaN(Number(aidRaw)) ? Number(aidRaw) : null;
        map.get(k)!.push({
          id: activityId ?? Math.floor(Math.random() * 1e9),
          sport,
          kind: "activity",
          activityId,
        });
      }
    }

    const planRows = selectPlanByRange(startIso, endIso);
    for (const p of planRows as any[]) {
      const k = String(p.plan_date ?? "").slice(0, 10);
      if (!k || !map.has(k)) continue;

      const title = String(p.title || "").toLowerCase();
      const sType = String(p.session_type || "").toLowerCase();
      const sport = safeSportKey(p.sport || "other");
      const duration = p.duration_min ?? null;

      const isRest = sType === "rest" || title.startsWith("rest") || duration === 0;
      const arr = map.get(k)!;

      if (content === "plan") {
        if (!isRest) {
          arr.push({
            id: Number(p.id) || Math.floor(Math.random() * 1e9),
            sport,
            kind: "plan",
            activityId: null,
          });
        }
        continue;
      }

      const actIdRaw = (p as any).activity_id;
      const activityId = actIdRaw != null && !Number.isNaN(Number(actIdRaw)) ? Number(actIdRaw) : null;

      if (activityId) {
        const idx = arr.findIndex((it) => it.kind === "activity" && it.activityId === activityId);
        if (idx >= 0) {
          arr[idx] = { ...arr[idx], kind: "done", activityId };
          continue;
        }
      }

      if (!isRest) {
        const isPast = k < todayIso;
        const kind: CalendarItemKind = isPast ? "missed" : "plan";
        arr.push({
          id: Number(p.id) || Math.floor(Math.random() * 1e9),
          sport,
          kind,
          activityId: activityId ?? null,
        });
      }
    }

    for (const [key, arr] of map.entries()) {
      map.set(key, dedupeCalendarItems<DayItem>(arr));
    }

    return map;
  }, [startDate, startIso, endIso, selectByRange, selectPlanByRange, externalRows, content]);

  const todayStr = new Date().toDateString();

  const dowLabels = React.useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const daysMap = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
      return t(`common.weeksShort.${daysMap[d.getDay()]}` as any);
    });
  }, [startDate, t]);

  return (
    <div className="flex flex-col h-full">
      <div
        className={CAL_WIDGET_DOW_ROW}
        style={{ color: appColors.textMuted }}
      >
        {dowLabels.map((dayLabel, idx) => (
          <div key={idx} className={CAL_WIDGET_DOW_CELL}>
            {dayLabel}
          </div>
        ))}
      </div>

      <div
        className={CAL_WIDGET_GRID}
        onClick={onOpen}
        style={{ cursor: onOpen ? "pointer" : "default" }}
      >
        {Array.from({ length: 7 }).map((_, i) => {
          const d = new Date(startDate);
          d.setDate(startDate.getDate() + i);

          const key = iso(d.getFullYear(), d.getMonth(), d.getDate());
          const items = byDay.get(key) ?? [];
          const shown = items.slice(0, perDayLimit);
          const isToday = d.toDateString() === todayStr;
          const isSelected = key === selectedDateIso;

          // 👈 Tu sme pridali zvýraznenie označeného dňa
          const cellStyle: React.CSSProperties = {
            background: isSelected ? "rgba(255,255,255,0.08)" : appColors.inputBg,
            borderColor: isSelected ? appColors.brandPrimary : appColors.surfaceCardBorder,
            color: appColors.textPrimary,
            WebkitTapHighlightColor: "transparent",
            cursor: onSelectDate ? "pointer" : "default",
            ...(isSelected 
              ? { boxShadow: `0 0 0 2px ${appColors.brandPrimary}` }
              : isToday 
                ? { boxShadow: `0 0 0 2px ${appColors.statusSuccess}55` } 
                : null),
          };

          return (
            <div 
              key={key} 
              className={CAL_WIDGET_DAY_CELL} 
              style={cellStyle}
              onClick={(e) => {
                if (onSelectDate) {
                  e.stopPropagation();
                  onSelectDate(key);
                }
              }}
            >
              <div className="flex flex-col">
                <span className={CAL_WIDGET_DAY_NUM}>{d.getDate()}</span>

                <div className={CAL_WIDGET_ITEMS_WRAP}>
                  {shown.map((it) => {
                    const color = SPORT_COLORS[String(it.sport)] ?? SPORT_COLORS.other;

                    if (it.kind === "activity" || it.kind === "external") {
                      return (
                        <span
                          key={`${it.kind}-${it.id}`}
                          className={CAL_WIDGET_DOT}
                          style={{ backgroundColor: color }}
                        />
                      );
                    }

                    if (it.kind === "plan") {
                      return (
                        <span
                          key={`${it.kind}-${it.id}`}
                          className={CAL_WIDGET_PLAN_DOT}
                          style={{
                            borderColor: color,
                            backgroundColor: "transparent",
                          }}
                        />
                      );
                    }

                    if (it.kind === "done") {
                      return (
                        <span
                          key={`${it.kind}-${it.id}`}
                          className={CAL_WIDGET_MARK}
                          style={{ color }}
                        >
                          ✓
                        </span>
                      );
                    }

                    return (
                      <span
                        key={`${it.kind}-${it.id}`}
                        className={CAL_WIDGET_MARK}
                        style={{ color }}
                      >
                        ✕
                      </span>
                    );
                  })}

                  {items.length > shown.length && (
                    <span
                      className={CAL_WIDGET_MORE}
                      style={{ color: appColors.textMuted }}
                    >
                      +{items.length - shown.length}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}