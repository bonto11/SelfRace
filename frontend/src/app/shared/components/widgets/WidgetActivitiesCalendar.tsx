// src/shared/components/widgets/WidgetActivitiesCalendar.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import { appColors } from "@/app/shared/ui/theme/app_colors";

import { useUserId } from "@/app/shared/hooks/useUserId";
import { useActivityData } from "@/app/shared/components/dataProviders/ActivityDataProvider";
import { useCoachData } from "@/app/shared/components/dataProviders/CoachDataProvider";

import { apiGetExternalEventsWindow } from "@/app/features/coach/api/coach_external_events";
import { apiFetchUserPref } from "@/app/features/prefs/api/prefs";

import type { ExternalEvent } from "@/app/features/coach/types/externalEvents";
import type { SportKey } from "@/app/features/calendar/types/calendarTypes";

import {
  dedupeCalendarItems,
  eventDateIso,
  type CalendarItemBase,
  type CalendarItemKind,
} from "@/app/features/calendar/utils/calendarSlots";

import { WIDGET_ERROR_LINE } from "@/app/shared/ui/tokens/widgets";
import { NO_X_OVERFLOW } from "@/app/shared/ui/tokens/core";
import { WIDGET_FOOTNOTE } from "@/app/shared/ui/tokens"; // ✅ Pridaný import pre Footnote
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

/* ---------- helpers ---------- */

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
const iso = (y: number, m0: number, d: number) =>
  `${y}-${pad2(m0 + 1)}-${pad2(d)}`;

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

type Props = {
  openHref?: string;
  perDayLimit?: number;
};

export default function WidgetActivitiesCalendar({
  openHref = "/calendar",
  perDayLimit = 6,
}: Props) {
  const router = useRouter();
  const { userId } = useUserId();
  const { selectByRange } = useActivityData();
  const t = useT();
  const { plan } = useCoachData();
  const { selectPlanByRange } = plan;

  const [isMedicalSuspend, setIsMedicalSuspend] = React.useState(false);

  const monday = startOfWeek();
  const sunday = React.useMemo(() => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + 6);
    return d;
  }, [monday]);

  const startIso = iso(
    monday.getFullYear(),
    monday.getMonth(),
    monday.getDate(),
  );
  const endIso = iso(sunday.getFullYear(), sunday.getMonth(), sunday.getDate());

  const [externalRows, setExternalRows] = React.useState<ExternalEvent[]>([]);
  const [extErr, setExtErr] = React.useState<string | null>(null);
  
  // ✅ Pridaný stav pre zranenie do kalendára
  const [activeInjury, setActiveInjury] = React.useState<{ severity: number; text: string } | null>(null);

  React.useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const prefs = await apiFetchUserPref(userId, "coach.prefs");
        if (prefs && Array.isArray(prefs.injuries)) {
          const maxSev = Math.max(...prefs.injuries.map((i: any) => i.severity || 0), 0);
          setIsMedicalSuspend(maxSev >= 7);
        }
      } catch (err) {
        console.warn("[CalendarWidget] Failed to check injury state", err);
      }
    })();
  }, [userId]);

  React.useEffect(() => {
    if (!userId) return;
    let alive = true;

    (async () => {
      setExtErr(null);
      try {
        // ✅ Paralelné volanie udalostí aj zranení pre rýchlejší render
        const [rows, prefsRes] = await Promise.all([
          apiGetExternalEventsWindow(userId, startIso, endIso).catch((e) => { throw e; }),
          apiFetchUserPref(userId, "coach.prefs").catch(() => null)
        ]);

        if (!alive) return;
        setExternalRows(Array.isArray(rows) ? rows : []);

        // Vyhodnotenie zranenia
        if (prefsRes && Array.isArray(prefsRes.injuries) && prefsRes.injuries.length > 0) {
          const maxInjury = prefsRes.injuries.reduce((prev: any, current: any) => {
            return (current.severity || 0) > (prev.severity || 0) ? current : prev;
          }, { severity: 0 });

          if (maxInjury && maxInjury.severity > 0) {
            setActiveInjury({
              severity: maxInjury.severity,
              text: `${t(`prefs.sections.injuriesSection.areas.${maxInjury.area}` as any) || maxInjury.area} (${maxInjury.severity}/10)`
            });
          }
        } else {
           setActiveInjury(null);
        }

      } catch (e: any) {
        if (!alive) return;
        setExternalRows([]);
        setExtErr(e?.message ?? t("calendar.widget.errorFailedLoad" as any));
      }
    })();

    return () => {
      alive = false;
    };
  }, [userId, startIso, endIso, t]);

  const byDay = React.useMemo(() => {
    const map = new Map<string, DayItem[]>();
    const todayIso = new Date().toISOString().slice(0, 10);

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      map.set(iso(d.getFullYear(), d.getMonth(), d.getDate()), []);
    }

    for (const ev of externalRows) {
      const k = eventDateIso(ev);
      if (!k || !map.has(k)) continue;

      const sport = safeSportKey(
        (ev as any).sport ?? (ev as any).sport_type ?? "other",
      );
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

      const sport = safeSportKey(
        r.sport ?? r.sport_type_fe ?? r.sport_type ?? "other",
      );
      const aidRaw = r.activity_id;
      const activityId =
        aidRaw != null && !Number.isNaN(Number(aidRaw)) ? Number(aidRaw) : null;

      map.get(k)!.push({
        id: activityId ?? Math.floor(Math.random() * 1e9),
        sport,
        kind: "activity",
        activityId,
      });
    }

    const planRows = selectPlanByRange(startIso, endIso);
    for (const p of planRows as any[]) {
      const k = String(p.plan_date ?? "").slice(0, 10);
      if (!k || !map.has(k)) continue;

      const title = String(p.title || "").toLowerCase();
      const sType = String(p.session_type || "").toLowerCase();
      const sport = safeSportKey(p.sport || "other");
      const duration = p.duration_min ?? null;

      const isRest =
        sType === "rest" || title.startsWith("rest") || duration === 0;

      const arr = map.get(k)!;

      const actIdRaw = (p as any).activity_id;
      const activityId =
        actIdRaw != null && !Number.isNaN(Number(actIdRaw))
          ? Number(actIdRaw)
          : null;

      if (activityId) {
        const idx = arr.findIndex(
          (it) => it.kind === "activity" && it.activityId === activityId,
        );
        if (idx >= 0) {
          arr[idx] = { ...arr[idx], kind: "done", activityId };
          continue;
        }
      }

      if (!isRest) {
        const isPast = k < todayIso;
        const kind: CalendarItemKind = isPast ? "missed" : "plan";
        arr.push({
          id: Number(p.id),
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
  }, [
    monday,
    startIso,
    endIso,
    selectByRange,
    selectPlanByRange,
    externalRows,
  ]);

  const weekLabel =
    `${monday.toLocaleDateString("sk-SK", { month: "short", day: "2-digit" })} – ` +
    `${sunday.toLocaleDateString("sk-SK", { month: "short", day: "2-digit" })}`;

  const handleOpen = () => router.push(openHref);

  const todayStr = new Date().toDateString();
  const dow = [t("common.weeksShort.mon" as any), t("common.weeksShort.tue" as any), t("common.weeksShort.wed" as any), t("common.weeksShort.thu" as any), t("common.weeksShort.fri" as any),t("common.weeksShort.sat" as any), t("common.weeksShort.sun" as any)] as const;

  return (
    <WidgetCard
      title={t("calendar.widget.title")} // ✅ Odstránený weekLabel z nadpisu
      tooltip={t("calendar.widget.tooltip" as any)}
      onOpen={handleOpen}
      accent={isMedicalSuspend ? "danger" : "none"}
      interactive
      minH={160}
      innerClassName={NO_X_OVERFLOW}
    >
      <div className="flex flex-col h-full min-h-[110px]">
        <div className="flex-1">
          {extErr && <div className={WIDGET_ERROR_LINE}>{extErr}</div>}

          {/* ✅ Jasné varovanie pre používateľa nad mriežkou kalendára */}
          {activeInjury && (
            <div className={`mb-3 px-3 py-2 rounded-md border text-xs flex items-center gap-2 ${
                activeInjury.severity >= 7 
                  ? "bg-red-500/10 border-red-500/20 text-red-400" 
                  : "bg-yellow-500/10 border-yellow-500/20 text-yellow-400"
              }`}>
              <div className="flex-shrink-0">
                ⚠️
              </div>
              <div className="leading-tight">
                <strong>Zranenie nahlásené:</strong> {activeInjury.text}
                <div className="opacity-80 text-[10px] mt-0.5">
                  {activeInjury.severity >= 7 ? "Kalendár zablokovaný (Lekárske voľno)." : "Tréningy upravené pre zotavenie."}
                </div>
              </div>
            </div>
          )}

          <div
            className={CAL_WIDGET_DOW_ROW}
            style={{ color: appColors.textMuted }}
          >
            {dow.map((d) => (
              <div key={d} className={CAL_WIDGET_DOW_CELL}>
                {d}
              </div>
            ))}
          </div>

          <div
            className={CAL_WIDGET_GRID}
            onClick={handleOpen}
            aria-label={t("calendar.widget.open" as any)}
          >
            {Array.from({ length: 7 }).map((_, i) => {
              const d = new Date(monday);
              d.setDate(monday.getDate() + i);

              const key = iso(d.getFullYear(), d.getMonth(), d.getDate());
              const items = byDay.get(key) ?? [];
              const shown = items.slice(0, perDayLimit);
              const isToday = d.toDateString() === todayStr;

              const cellStyle: React.CSSProperties = {
                background: appColors.inputBg,
                borderColor: appColors.surfaceCardBorder,
                color: appColors.textPrimary,
                WebkitTapHighlightColor: "transparent",
                ...(isToday
                  ? { boxShadow: `0 0 0 2px ${appColors.statusSuccess}55` }
                  : null),
              };

              return (
                <div key={key} className={CAL_WIDGET_DAY_CELL} style={cellStyle}>
                  <div className="flex flex-col">
                    <span className={CAL_WIDGET_DAY_NUM}>{d.getDate()}</span>

                    <div className={CAL_WIDGET_ITEMS_WRAP}>
                      {shown.map((it) => {
                        const color =
                          SPORT_COLORS[String(it.sport)] ?? SPORT_COLORS.other;

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

        {/* ✅ Dátum presunutý dole do pätice, prilepený naspodok vďaka mt-auto */}
        <div className={`${WIDGET_FOOTNOTE} mt-auto pt-4`}>
          {weekLabel}
        </div>
      </div>
    </WidgetCard>
  );
}