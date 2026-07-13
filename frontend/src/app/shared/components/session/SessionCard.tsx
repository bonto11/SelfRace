// src/app/shared/components/session/SessionCard.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useT } from "@/app/shared/i18n/useT";

import { useUserId } from "@/app/shared/hooks/useUserId";
import { apiGetPlanByActivityId, type DailyPlanSession } from "@/app/features/coach/api/coach_plan_daily";

import SportBadge, { getSportColor } from "@/app/shared/ui/components/SportBadge";

import { ComponentVariant } from "@/app/features/activities/types/activities";
import { DetailSession } from "@/app/shared/components/session/DetailSession";

import {
  SESSION_CARD,
  SESSION_CARD_STYLE,
  SESSION_CARD_HOVER,
  SESSION_VARIANT_PAD,
  SESSION_HEAD,
  SESSION_BODY,
  SESSION_DATE,
  SESSION_TITLE,
  SESSION_SUBTITLE,
  SESSION_FAVORITE_STAR,
  SESSION_PILL,
  SESSION_PLAN_STATUS_STYLE,
  SESSION_TOGGLE_BTN,
  SESSION_TOGGLE_BTN_STYLE,
  SESSION_TOGGLE_BTN_HOVER,
  SESSION_TOGGLE_ICON,
  SESSION_FLUSH_DETAIL,
  SESSION_FLUSH_DETAIL_STYLE,
} from "@/app/shared/ui/tokens";

/* ========================================================= */
/* KIND: "session" = plan a/alebo activity (jednotny model)  */
/*       "external" a "bests" ostavaju samostatne, ako doteraz*/
/* ========================================================= */

export type SessionKind = "session" | "external" | "bests";
export type PlanStatus = "planned" | "done" | "missed" | "postponed";

/**
 * Status indikator (guľôčka pred titulkom).
 * Farba VŽDY podľa športu (getSportColor), tvar podľa kombinácie planId/activityId:
 *  - hasPlan && hasActivity              -> ✓ (splnené / spárované)
 *  - hasPlan && !hasActivity && postponed -> ↷ (odložené)
 *  - hasPlan && !hasActivity && missed     -> ✕ (zmeškané)
 *  - hasPlan && !hasActivity && planned    -> ○ (naplánované, prázdny kruh)
 *  - hasActivity && !hasPlan               -> ● (voľná aktivita bez plánu)
 */
export function StatusIndicator({
  hasPlan,
  hasActivity,
  status,
  sport,
}: {
  hasPlan: boolean;
  hasActivity: boolean;
  status?: PlanStatus;
  sport: string;
}) {
  const color = getSportColor(sport);
  const style = { color };

  if (hasPlan && hasActivity) {
    return (
      <span style={style} className="font-bold" title="Splnené">
        ✓
      </span>
    );
  }

  if (hasPlan && !hasActivity) {
    if (status === "postponed") {
      return (
        <span style={style} className="font-bold text-xs" title="Odložené">
          ↷
        </span>
      );
    }
    if (status === "missed") {
      return (
        <span style={style} className="font-bold" title="Zmeškané">
          ✕
        </span>
      );
    }
    return (
      <span style={style} title="Naplánované">
        ○
      </span>
    );
  }

  if (hasActivity && !hasPlan) {
    return (
      <span style={style} title="Aktivita">
        ●
      </span>
    );
  }

  return null;
}

export type KPI = { label: string; value: any };

type Base = {
  id: string | number;
  kind: SessionKind;
  title: string;
  dateIso?: string | null;
  sport: string;
  defaultOpen?: boolean;
  hideDateLine?: boolean;
  subtitle?: string | null;
  kpis?: KPI[];
  notes?: string | null;

  // 🌟 Spoločné identifikátory - jadro novej logiky.
  // planId != null  -> existuje naplánovaná session v coach_plan_daily
  // activityId != null -> existuje reálna vykonaná aktivita (Strava a pod.)
  // Obe naraz -> splnený/spárovaný plán.
  planId?: number | string | null;
  activityId?: number | null;
};

export type SessionItem = Base & {
  kind: "session";
  status?: PlanStatus;

  // Plan-related (platné ak planId != null)
  planDur?: string | null;
  planIntensity?: string | null;
  planTarget?: string | null;
  planNotes?: string | null;
  planRaw?: any;
  planStructure?: any;
  planExercises?: any[];

  // Activity-related (platné ak activityId != null)
  timeStr?: string | null;
  distanceStr?: string | null;
  avgHr?: number | null;
  maxHr?: number | null;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
};

export type BestsSession = Base & {
  kind: "bests";
  activityId: number;
  timeStr?: string | null;
  distanceStr?: string | null;
  avgHr?: number | null;
  maxHr?: number | null;
};

export type ExternalSession = Base & {
  kind: "external";
  time?: string | null;
  durationMin?: number | null;
  notes?: string | null;
};

export type SessionCardItem = SessionItem | BestsSession | ExternalSession;

export type SessionCardProps = {
  variant?: ComponentVariant;
  item: SessionCardItem;
  onOpenActivity?: (activityId: number) => void;
  showPlanDebug?: boolean;
  showAdvanced?: boolean;

  onRefreshPlan?: () => void;
  onDiscard?: (sessionId: number) => void;

  planReschedule?: {
    enabled?: boolean;
    dates: string[];
    dayCounts?: Record<string, number>;
    maxPerDay?: number;
    onChangeDate: (args: {
      sessionId: string | number;
      fromDate: string;
      toDate: string;
    }) => void | Promise<void>;
  };
};

function prettySkDate(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const day = d.toLocaleDateString("sk-SK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const wk = d.toLocaleDateString("sk-SK", { weekday: "short" });
  return `${wk} · ${day}`;
}

function shortSkDate(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("sk-SK", { day: "2-digit", month: "2-digit" });
}

function shortSkDay(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("sk-SK", { weekday: "short" });
}

function parseKm(s?: string | null): number | null {
  if (!s) return null;
  const m = s.match(/(-?\d+(?:[.,]\d+)?)\s*km/i);
  if (!m) return null;
  return Number(String(m[1]).replace(",", "."));
}

/* ========================================================= */
/* HLAVNÝ KOMPONENT                                          */
/* ========================================================= */

export default function SessionCard({
  variant = "activity",
  item,
  onOpenActivity,
  showPlanDebug = false,
  showAdvanced = false,
  onRefreshPlan,
  onDiscard,
  planReschedule,
}: SessionCardProps) {
  const t = useT();
  const { userId } = useUserId();
  const [opened, setOpened] = useState<boolean>(!!item.defaultOpen);
  const [showReschedule, setShowReschedule] = useState(false);
  const [pendingDate, setPendingDate] = useState<string | null>(null);

  // 🌟 Auto-doplnenie plánu podľa activityId, ked ho item nema (napr. Activities stranka).
  // Fetchne sa raz po prvom otvoreni karty a vysledok sa cachne.
  const [resolvedPlan, setResolvedPlan] = useState<DailyPlanSession | null>(null);
  const [planLookupDone, setPlanLookupDone] = useState(false);
  const [planLookupLoading, setPlanLookupLoading] = useState(false);

  const isSession = item.kind === "session";
  const baseHasPlan = isSession && (item as SessionItem).planId != null;
  const baseHasActivity = isSession && (item as SessionItem).activityId != null;

  useEffect(() => {
    if (item.defaultOpen) setOpened(true);
  }, [item.defaultOpen]);

  useEffect(() => {
    if (isSession) setPendingDate(item.dateIso ?? null);
  }, [isSession, item.dateIso]);

  useEffect(() => {
    if (!opened) setShowReschedule(false);
  }, [opened]);

  // Reset lookup cache ak sa zmení samotná session (iná karta / iné activityId)
  useEffect(() => {
    setResolvedPlan(null);
    setPlanLookupDone(false);
  }, [item.id, baseHasActivity, isSession && (item as SessionItem).activityId]);

  useEffect(() => {
    if (!opened) return;
    if (!isSession) return;
    if (baseHasPlan) return; // plán už máme, netreba dohľadávať
    if (!baseHasActivity) return; // nemáme podľa čoho hľadať
    if (planLookupDone || planLookupLoading) return;
    if (!userId) return;

    const activityId = (item as SessionItem).activityId as number;

    let alive = true;
    setPlanLookupLoading(true);
    apiGetPlanByActivityId(Number(userId), activityId)
      .then((plan) => {
        if (!alive) return;
        setResolvedPlan(plan);
      })
      .finally(() => {
        if (!alive) return;
        setPlanLookupDone(true);
        setPlanLookupLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [opened, isSession, baseHasPlan, baseHasActivity, planLookupDone, planLookupLoading, userId, item]);

  const hasPlan = baseHasPlan || !!resolvedPlan;
  const hasActivity = baseHasActivity;

  const effectiveStatus: PlanStatus | undefined = isSession
    ? (item as SessionItem).status ?? (resolvedPlan?.status as PlanStatus | undefined)
    : undefined;

  const dateLine =
    item.hideDateLine || variant === "calendar" ? "" : prettySkDate(item.dateIso);

  const secondaryLine = useMemo(() => {
    if (variant === "calendar" && item.subtitle) return item.subtitle;

    if (item.kind === "bests") return null;

    if (item.kind === "external") {
      const ext = item as ExternalSession;
      const bits = [
        ext.time ? ext.time : null,
        ext.durationMin != null ? `${ext.durationMin} min` : null,
      ].filter(Boolean);
      return bits.length ? bits.join(" · ") : null;
    }

    // kind === "session"
    const s = item as SessionItem;

    if (hasActivity) {
      const distKm = parseKm(s.distanceStr);
      if (distKm != null && distKm > 0 && s.distanceStr) {
        return `${t("sessions.card.distance")} ${s.distanceStr}`;
      }
      if (s.timeStr) return `${t("sessions.card.time")} ${s.timeStr}`;
      return null;
    }

    if (hasPlan) {
      const bits = [s.planDur ?? "", s.planIntensity ?? "", s.planTarget ?? ""].filter(
        Boolean,
      );
      return bits.length ? bits.join(" · ") : null;
    }

    return null;
  }, [item, variant, t, hasActivity, hasPlan]);

  const canReschedulePlan =
    isSession &&
    hasPlan &&
    !!planReschedule?.enabled &&
    Array.isArray(planReschedule?.dates) &&
    planReschedule.dates.length > 0 &&
    typeof planReschedule.onChangeDate === "function" &&
    typeof item.dateIso === "string" &&
    !!item.dateIso;

  const maxPerDay = planReschedule?.maxPerDay ?? 2;
  const dayCounts = planReschedule?.dayCounts ?? {};

  const planDateOptions = useMemo(() => {
    if (!canReschedulePlan) return [];
    const dates = planReschedule!.dates;

    return dates.map((d) => {
      const cnt = Number(dayCounts[d] ?? 0);
      const label = `${shortSkDate(d)} · ${shortSkDay(d)} (${cnt}/${maxPerDay})`;
      return { value: d, label, cnt };
    });
  }, [canReschedulePlan, planReschedule, dayCounts, maxPerDay]);

  const handlePlanDateChange = async (toDate: string) => {
    if (!canReschedulePlan) return;

    const fromDate = (item.dateIso as string) ?? "";
    if (!fromDate || !toDate || toDate === fromDate) {
      setPendingDate(fromDate || null);
      return;
    }

    const cnt = Number(dayCounts[toDate] ?? 0);
    if (cnt >= maxPerDay) {
      setPendingDate(fromDate);
      return;
    }

    setPendingDate(toDate);

    await planReschedule!.onChangeDate({
      sessionId: item.id,
      fromDate,
      toDate,
    });

    setShowReschedule(false);
  };

  return (
    <section
      className={[SESSION_CARD, SESSION_CARD_HOVER, SESSION_VARIANT_PAD[variant]].join(
        " ",
      )}
      style={SESSION_CARD_STYLE}
    >
      <div className={SESSION_HEAD}>
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-start gap-4">
            <div className="min-w-0 flex-1 pt-1">
              <div className="flex items-center gap-2">
                {isSession && (
                  <StatusIndicator
                    hasPlan={hasPlan}
                    hasActivity={hasActivity}
                    status={effectiveStatus}
                    sport={item.sport}
                  />
                )}
                <div className={SESSION_TITLE}>{item.title}</div>
              </div>

              {dateLine && (
                <div className={`${SESSION_DATE} mt-1 opacity-70 text-xs`}>{dateLine}</div>
              )}
              {secondaryLine && (
                <div className={`${SESSION_SUBTITLE} mt-0.5`}>{secondaryLine}</div>
              )}
            </div>

            <div className="flex flex-col items-end gap-2 shrink-0">
              <div className="flex items-center gap-1">
                {isSession && (item as SessionItem).isFavorite && (
                  <span className={SESSION_FAVORITE_STAR} title={t("sessions.card.favorite")}>
                    ★
                  </span>
                )}
                <div className="w-[120px] flex justify-center [&>*]:w-full [&>*]:flex [&>*]:items-center [&>*]:justify-center [&>*]:text-center">
                  <SportBadge sport={item.sport} />
                </div>
              </div>

              {isSession && hasPlan && effectiveStatus && (
                <span
                  className={[
                    SESSION_PILL,
                    "w-[120px] flex items-center justify-center text-center truncate",
                  ].join(" ")}
                  style={SESSION_PLAN_STATUS_STYLE[effectiveStatus]}
                >
                  {t(`sessions.status.${effectiveStatus}` as any)}
                </span>
              )}
            </div>
          </div>

          <div className="w-full flex justify-center -mt-1 pb-1">
            <button
              type="button"
              aria-expanded={opened}
              onClick={() => setOpened((s) => !s)}
              title={opened ? t("sessions.card.hideDetail") : t("sessions.card.showDetail")}
              className={[SESSION_TOGGLE_BTN, SESSION_TOGGLE_BTN_HOVER].join(" ")}
              style={SESSION_TOGGLE_BTN_STYLE}
            >
              <span className={[SESSION_TOGGLE_ICON, opened ? "rotate-180" : ""].join(" ")}>
                ▾
              </span>
            </button>
          </div>
        </div>
      </div>

      {opened && (
        <div className={SESSION_FLUSH_DETAIL} style={SESSION_FLUSH_DETAIL_STYLE}>
          <div className={SESSION_BODY}>
            <DetailSession
              variant={variant}
              item={item}
              hasPlan={hasPlan}
              hasActivity={hasActivity}
              resolvedPlan={resolvedPlan}
              planLookupLoading={planLookupLoading}
              onOpenActivity={onOpenActivity}
              showPlanDebug={showPlanDebug}
              showAdvanced={showAdvanced}
              onRefreshPlan={onRefreshPlan}
              onDiscard={onDiscard}
              planRescheduleUI={
                canReschedulePlan
                  ? {
                      show: showReschedule,
                      setShow: setShowReschedule,
                      currentDate: String(item.dateIso ?? ""),
                      pendingDate: pendingDate ?? String(item.dateIso ?? ""),
                      options: planDateOptions.map((o) => ({
                        value: o.value,
                        label: o.label,
                      })),
                      onSelect: handlePlanDateChange,
                    }
                  : null
              }
            />
          </div>
        </div>
      )}
    </section>
  );
}