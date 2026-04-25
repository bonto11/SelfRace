// src/app/shared/components/session/SessionCard.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useT } from "@/app/shared/i18n/useT";

import { useUserId } from "@/app/shared/hooks/useUserId";
import { useActivityData } from "@/app/shared/components/dataProviders/ActivityDataProvider";
import { toast } from "@/app/shared/ui/components/Toast";
import { apiPatchDailySessionStatus } from "@/app/features/coach/api/coach_plan_daily";

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

export type SessionKind = "activity" | "plan" | "external" | "bests";
export type PlanStatus = "planned" | "done" | "missed" | "skipped";

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
  showAdvanced?: boolean;
  
  // Callbacky pre refresh po akciách
  onRefreshPlan?: () => void;

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
/* MANUAL MATCH MODAL                                      */
/* ========================================================= */
type ManualMatchModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  session: PlanSession;
};

function ManualMatchModal({
  isOpen,
  onClose,
  onSuccess,
  session,
}: ManualMatchModalProps) {
  const t = useT();
  const { userId } = useUserId();
  const { rows: activities } = useActivityData();

  const [selectedActivityId, setSelectedActivityId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const recentActivities = useMemo(() => {
    if (!activities || activities.length === 0) return [];
    return [...activities]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 15);
  }, [activities]);

  if (!isOpen) return null;

  const handleMatch = async () => {
    if (!userId || !session.id || !selectedActivityId) return;

    setIsSaving(true);
    try {
      await apiPatchDailySessionStatus(userId, Number(session.id), {
        activity_id: selectedActivityId,
      });
      
      toast.success(t("sessions.matchModal.success"));
      onSuccess(); 
      onClose();
    } catch (error) {
      toast.error(t("sessions.matchModal.error"));
    } finally {
      setIsSaving(false);
    }
  };

  const formatDistance = (meters?: number | null) => {
    if (!meters) return null;
    return `${(meters / 1000).toFixed(2)} km`;
  };

  const formatTime = (seconds?: number | null) => {
    if (!seconds) return null;
    return `${Math.round(seconds / 60)} min`;
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return "";
    return new Date(isoString).toLocaleDateString("sk-SK", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-2xl bg-[#121212] border border-white/10 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        
        <div className="p-5 border-b border-white/10 shrink-0">
          <h3 className="text-lg font-bold text-white">
            {t("sessions.matchModal.title")}
          </h3>
          <p className="text-sm opacity-60 mt-1">
            {t("sessions.matchModal.subtitle")}
          </p>
          <div className="mt-2 text-emerald-400 font-semibold text-sm">
            {session.title}
          </div>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-3">
          {recentActivities.length === 0 ? (
            <div className="text-center text-sm opacity-50 py-8">
              {t("sessions.matchModal.noActivities")}
            </div>
          ) : (
            recentActivities.map((act) => {
              const isSelected = selectedActivityId === act.activity_id;
              const dist = formatDistance(act.distance_m);
              const time = formatTime(act.moving_time_s);
              const metrics = [dist, time].filter(Boolean).join(" · ");

              return (
                <button
                  key={act.activity_id}
                  onClick={() => setSelectedActivityId(act.activity_id)}
                  className={`w-full flex items-center gap-4 text-left p-3 rounded-xl border transition-all ${
                    isSelected
                      ? "border-emerald-500 bg-emerald-500/10"
                      : "border-white/10 bg-white/5 hover:bg-white/10"
                  }`}
                >
                  <div className="shrink-0">
                    <SportBadge sport={act.sport_type_fe || act.sport_type || "other"} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white truncate">
                      {act.name}
                    </div>
                    <div className="text-xs opacity-60 mt-0.5 flex justify-between">
                      <span>{formatDate(act.date)}</span>
                      {metrics && <span>{metrics}</span>}
                    </div>
                  </div>

                  <div className="shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors">
                    {isSelected ? (
                      <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full" />
                    ) : null}
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="p-5 border-t border-white/10 shrink-0 flex justify-end gap-3 bg-white/5">
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            {t("sessions.matchModal.btnCancel")}
          </Button>
          
          <Button
            variant="primary"
            onClick={handleMatch}
            disabled={!selectedActivityId || isSaving}
          >
            {isSaving ? t("sessions.matchModal.btnSaving") : t("sessions.matchModal.btnMatch")}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ========================================================= */

export default function SessionCard({
  variant = "activity",
  item,
  onOpenActivity,
  showPlanDebug = false,
  showAdvanced = false,
  onRefreshPlan,
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
      case "activity": {
        const act = item as ActivitySession;
        const distKm = parseKm(act.distanceStr);
        if (distKm != null && distKm > 0 && act.distanceStr) {
          return `${t("sessions.card.distance")} ${act.distanceStr}`;
        }
        if (act.timeStr) return `${t("sessions.card.time")} ${act.timeStr}`;
        return null;
      }
      
      case "bests": {
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
      <div className={SESSION_HEAD}>
        <div className="flex flex-col gap-3">
          
          <div className="flex justify-between items-start gap-4">
            
            <div className="min-w-0 flex-1 pt-1">
              <div className={SESSION_TITLE}>{item.title}</div>
              
              {dateLine && <div className={`${SESSION_DATE} mt-1 opacity-70 text-xs`}>{dateLine}</div>}
              {secondaryLine && <div className={`${SESSION_SUBTITLE} mt-0.5`}>{secondaryLine}</div>}
            </div>

            <div className="flex flex-col items-end gap-2 shrink-0">
              
              <div className="flex items-center gap-1">
                {item.kind === "activity" && (item as ActivitySession).isFavorite && (
                  <span className={SESSION_FAVORITE_STAR} title={t("sessions.card.favorite")}>
                    ★
                  </span>
                )}
                <div className="w-[120px] flex justify-center [&>*]:w-full [&>*]:flex [&>*]:items-center [&>*]:justify-center [&>*]:text-center">
                  <SportBadge sport={item.sport} />
                </div>
              </div>

              {item.kind === "plan" && (
                <span 
                  className={[SESSION_PILL, "w-[120px] flex items-center justify-center text-center truncate"].join(" ")} 
                  style={SESSION_PLAN_STATUS_STYLE[(item as PlanSession).status]}
                >
                  {t(`sessions.status.${(item as PlanSession).status}` as any)}
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
            <DetailBody
              variant={variant}
              item={item}
              onOpenActivity={onOpenActivity}
              showPlanDebug={showPlanDebug}
              showAdvanced={showAdvanced}
              onRefreshPlan={onRefreshPlan}
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

function DetailBody({
  variant,
  item,
  onOpenActivity,
  showPlanDebug,
  showAdvanced,
  onRefreshPlan,
  planRescheduleUI,
}: {
  variant: ComponentVariant;
  item: SessionCardItem;
  onOpenActivity?: (activityId: number) => void;
  showPlanDebug: boolean;
  showAdvanced: boolean;
  onRefreshPlan?: () => void;
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
  const { userId } = useUserId();
  const compactChart = variant !== "activity";
  const [isMatchModalOpen, setIsMatchModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

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

  // --- VNÚTORNÉ HANDLERY PRE API ---
  const handleSkip = async (sessionId: string | number) => {
    if (!userId || isProcessing) return;
    setIsProcessing(true);
    try {
      await apiPatchDailySessionStatus(userId, Number(sessionId), { status: "skipped" });
      toast.success(t("common.done"));
      if (onRefreshPlan) onRefreshPlan();
    } catch (e) {
      toast.error(t("common.error"));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUnmatch = async (sessionId: string | number) => {
    if (!userId || isProcessing) return;
    setIsProcessing(true);
    try {
      await apiPatchDailySessionStatus(userId, Number(sessionId), { unmatch: true });
      toast.success(t("common.done"));
      if (onRefreshPlan) onRefreshPlan();
    } catch (e) {
      toast.error(t("common.error"));
    } finally {
      setIsProcessing(false);
    }
  };

  if (item.kind === "plan") {
    const plan = item as PlanSession;

    return (
      <div className="space-y-3">
        
        <ManualMatchModal
          isOpen={isMatchModalOpen}
          onClose={() => setIsMatchModalOpen(false)}
          session={plan}
          onSuccess={() => {
            if (onRefreshPlan) onRefreshPlan();
          }}
        />

        {showAdvanced && (
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 flex flex-col gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="text-[11px] uppercase tracking-wider opacity-50 font-semibold">
              {t("sessions.card.managePlan")}
            </div>
            
            <div className="flex flex-wrap gap-2">
              {/* Presunúť (Reschedule) */}
              {planRescheduleUI && (
                <Button
                  size="xs"
                  variant="secondary"
                  disabled={isProcessing}
                  onClick={() => planRescheduleUI.setShow((s) => !s)}
                >
                  {planRescheduleUI.show 
                    ? t("common.cancel")
                    : t("sessions.card.actions.reschedule")}
                </Button>
              )}

              {/* Preskočiť (Skip) - TERAZ FUNKČNÉ */}
              {plan.status === "planned" && (
                <Button
                  size="xs"
                  variant="secondary"
                  disabled={isProcessing}
                  onClick={() => handleSkip(plan.id)}
                >
                  {t("sessions.card.actions.skip")}
                </Button>
              )}

              {/* Spárovať aktivitu (Manual Match) */}
              {(plan.status === "planned" || plan.status === "missed") && (
                <Button
                  size="xs"
                  variant="primary"
                  disabled={isProcessing}
                  onClick={() => setIsMatchModalOpen(true)}
                >
                  {t("sessions.card.actions.match")}
                </Button>
              )}

              {/* Zrušiť spárovanie (Unmatch) - TERAZ FUNKČNÉ */}
              {plan.status === "done" && (
                <Button
                  size="xs"
                  variant="secondary"
                  disabled={isProcessing}
                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10 border-red-500/20 transition-colors"
                  onClick={() => handleUnmatch(plan.id)}
                >
                  {t("sessions.card.actions.unmatch")}
                </Button>
              )}
            </div>

            {/* Zobrazenie formulára na presun */}
            {planRescheduleUI?.show && (
              <div className="mt-2 p-2 bg-black/20 rounded-lg border border-black/40">
                <SelectField
                  value={planRescheduleUI.pendingDate}
                  onChange={(e) => planRescheduleUI.onSelect(String(e.target.value))}
                  options={planRescheduleUI.options}
                  variant="editable"
                />

                <div className="mt-2 text-[11px] opacity-60">
                  {t("sessions.card.reschedule.current")} {shortSkDate(planRescheduleUI.currentDate)} ·{" "}
                  {shortSkDay(planRescheduleUI.currentDate)}
                </div>
              </div>
            )}
          </div>
        )}

        <PlanSessionDetail
          variant={variant}
          item={plan as any}
          showPlanDebug={showPlanDebug}
          showAdvanced={showAdvanced}
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