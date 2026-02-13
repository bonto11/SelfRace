"use client";

import { useEffect, useMemo, useState } from "react";
import { useT } from "@/app/shared/i18n/useT";

import SportBadge from "@/app/shared/ui/components/SportBadge";
import Button from "@/app/shared/ui/components/Button";
import SelectField from "@/app/shared/ui/components/SelectField";

import { ComponentVariant } from "@/app/features/activities/types/activities";
import { ActivitySessionDetail } from "@/app/shared/components/session/ActivitySessionDetail";
import PlanSessionDetail from "@/app/shared/components/session/PlanSessionDetail";
import ExternalSessionDetail from "@/app/shared/components/session/ExternalSessionDetail";
import BestsSessionDetail from "@/app/shared/components/session/BestsSessionDetail";
import { MetricGrid } from "@/app/shared/components/session/MetricGrid";
import { safeText } from "@/app/shared/components/session/sessionUtils";

import {
  SESSION_CARD,
  SESSION_CARD_STYLE,
  SESSION_CARD_HOVER,
  SESSION_VARIANT_PAD,
  SESSION_HEAD,
  SESSION_BODY,
  SESSION_HEAD_ROW,
  SESSION_HEAD_LEFT,
  SESSION_HEAD_RIGHT,
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

/** ========== Types ========== */

export type SessionKind = "activity" | "plan" | "external" | "bests";
export type PlanStatus = "planned" | "done" | "missed";

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
};

export type ActivitySession = Base & {
  kind: "activity";
  activityId: number;
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

export type PlanSession = Base & {
  kind: "plan";
  status: PlanStatus;
  planDur?: string | null;
  planIntensity?: string | null;
  planTarget?: string | null;
  planNotes?: string | null;
  planRaw?: any;
  planStructure?: any;
  planExercises?: any[];
};

export type ExternalSession = Base & {
  kind: "external";
  time?: string | null;
  durationMin?: number | null;
  notes?: string | null;
};

export type SessionCardItem =
  | ActivitySession
  | BestsSession
  | PlanSession
  | ExternalSession;

export type SessionCardProps = {
  variant?: ComponentVariant;
  item: SessionCardItem;
  onOpenActivity?: (activityId: number) => void;
  showPlanDebug?: boolean;
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

/** ========== Helpers ========== */

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

/** ========== Component ========== */

export default function SessionCard({
  variant = "activity",
  item,
  onOpenActivity,
  showPlanDebug = false,
  planReschedule,
}: SessionCardProps) {
  const t = useT();
  const [opened, setOpened] = useState<boolean>(!!item.defaultOpen);
  const [showReschedule, setShowReschedule] = useState(false);
  const [pendingDate, setPendingDate] = useState<string | null>(null);

  useEffect(() => {
    if (item.defaultOpen) setOpened(true);
  }, [item.defaultOpen]);

  useEffect(() => {
    if (item.kind === "plan") setPendingDate(item.dateIso ?? null);
  }, [item.kind, item.dateIso]);

  useEffect(() => {
    if (!opened) setShowReschedule(false);
  }, [opened]);

  const dateLine =
    item.hideDateLine || variant === "calendar" ? "" : prettySkDate(item.dateIso);

  const secondaryLine = useMemo(() => {
    if (variant === "calendar" && item.subtitle) return item.subtitle;

    switch (item.kind) {
      case "activity":
      case "bests": {
        const act = item as ActivitySession | BestsSession;
        const distKm = parseKm(act.distanceStr);
        if (distKm != null && distKm > 0 && act.distanceStr) {
          return `${t("sessions.card.distance")} ${act.distanceStr}`;
        }
        if (act.timeStr) return `${t("sessions.card.time")} ${act.timeStr}`;
        return null;
      }

      case "plan": {
        const plan = item as PlanSession;
        const bits = [plan.planDur ?? "", plan.planIntensity ?? "", plan.planTarget ?? ""].filter(Boolean);
        return bits.length ? bits.join(" · ") : null;
      }

      case "external": {
        const ext = item as ExternalSession;
        const bits = [
          ext.time ? ext.time : null, 
          ext.durationMin != null ? `${ext.durationMin} min` : null
        ].filter(Boolean);
        return bits.length ? bits.join(" · ") : null;
      }

      default:
        return null;
    }
  }, [item, variant, t]);

  const canReschedulePlan =
    item.kind === "plan" &&
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
      className={[SESSION_CARD, SESSION_CARD_HOVER, SESSION_VARIANT_PAD[variant]].join(" ")}
      style={SESSION_CARD_STYLE}
    >
      {/* HEADER */}
      <div className={SESSION_HEAD}>
        <div className={SESSION_HEAD_ROW}>
          <div className={SESSION_HEAD_LEFT}>
            {dateLine && <div className={SESSION_DATE}>{dateLine}</div>}

            <div className="min-w-0">
              <div className={SESSION_TITLE}>{item.title}</div>
              {secondaryLine && <div className={SESSION_SUBTITLE}>{secondaryLine}</div>}
            </div>
          </div>

          <div className={SESSION_HEAD_RIGHT}>
            {item.kind === "activity" && (item as ActivitySession).isFavorite && (
              <span className={SESSION_FAVORITE_STAR} title={t("sessions.card.favorite")}>
                ★
              </span>
            )}

            {item.kind === "plan" && (
              <span 
                className={SESSION_PILL} 
                style={SESSION_PLAN_STATUS_STYLE[(item as PlanSession).status]}
              >
                {t(`sessions.status.${(item as PlanSession).status}` as any)}
              </span>
            )}

            <SportBadge sport={item.sport} />

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

      {/* DETAIL */}
      {opened && (
        <div className={SESSION_FLUSH_DETAIL} style={SESSION_FLUSH_DETAIL_STYLE}>
          <div className={SESSION_BODY}>
            <DetailBody
              variant={variant}
              item={item}
              onOpenActivity={onOpenActivity}
              showPlanDebug={showPlanDebug}
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

/** ========== Detail router ========== */

function DetailBody({
  variant,
  item,
  onOpenActivity,
  showPlanDebug,
  planRescheduleUI,
}: {
  variant: ComponentVariant;
  item: SessionCardItem;
  onOpenActivity?: (activityId: number) => void;
  showPlanDebug: boolean;
  planRescheduleUI: null | {
    show: boolean;
    setShow: (v: boolean | ((prev: boolean) => boolean)) => void;
    currentDate: string;
    pendingDate: string;
    options: { value: string; label: string }[];
    onSelect: (toDate: string) => void | Promise<void>;
  };
}) {
  const t = useT();
  const compactChart = variant !== "activity";

  const kpis = Array.isArray(item.kpis) ? item.kpis : [];
  const hasKpis = kpis.length > 0;

  const kpiBlock = hasKpis ? (
    <MetricGrid
      cols={4}
      metrics={kpis.map((k) => ({
        label: safeText(k.label),
        value: safeText(k.value),
      }))}
    />
  ) : null;

  if (item.kind === "plan") {
    return (
      <div className="space-y-3">
        {planRescheduleUI ? (
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs opacity-70">
                {t("sessions.card.reschedule.title")}
              </div>

              <Button
                size="xs"
                variant="secondary"
                onClick={() => planRescheduleUI.setShow((s) => !s)}
              >
                {planRescheduleUI.show 
                  ? t("sessions.card.reschedule.close") 
                  : t("sessions.card.reschedule.action")}
              </Button>
            </div>

            {planRescheduleUI.show ? (
              <div className="mt-2">
                <SelectField
                  value={planRescheduleUI.pendingDate}
                  onChange={(e) => planRescheduleUI.onSelect(String(e.target.value))}
                  options={planRescheduleUI.options}
                  variant="editable"
                />

                <div className="mt-1 text-[11px] opacity-60">
                  {t("sessions.card.reschedule.current")} {shortSkDate(planRescheduleUI.currentDate)} ·{" "}
                  {shortSkDay(planRescheduleUI.currentDate)}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        <PlanSessionDetail
          variant={variant}
          item={item as any}
          showPlanDebug={showPlanDebug}
        />
      </div>
    );
  }

  if (item.kind === "external") {
    return <ExternalSessionDetail variant={variant} item={item as any} />;
  }

  if (item.kind === "bests") {
    return (
      <BestsSessionDetail
        item={item as any}
        kpiBlock={kpiBlock}
        hasKpis={hasKpis}
        compactChart={compactChart}
        onOpenActivity={onOpenActivity}
      />
    );
  }

  return (
    <ActivitySessionDetail
      item={item as any}
      kpiBlock={kpiBlock}
      hasKpis={hasKpis}
      compactChart={compactChart}
      onOpenActivity={onOpenActivity}
    />
  );
}