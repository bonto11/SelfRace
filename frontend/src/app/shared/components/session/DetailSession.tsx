// src/app/shared/components/session/DetailSession.tsx
"use client";

import { useState } from "react";
import { useT } from "@/app/shared/i18n/useT";

import { useUserId } from "@/app/shared/hooks/useUserId";
import { toast } from "@/app/shared/ui/components/Toast";
import {
  apiPatchDailySessionStatus,
  type DailyPlanSession,
} from "@/app/features/coach/api/coach_plan_daily";

import Button from "@/app/shared/ui/components/Button";
import SelectField from "@/app/shared/ui/components/SelectField";
import ActivitySelectorDate from "@/app/shared/ui/components/ActivitySelectorDate";

import { ComponentVariant } from "@/app/features/activities/types/activities";
import { ActivitySessionDetail } from "@/app/shared/components/session/DetailActivity";
import PlanSessionDetail from "@/app/shared/components/session/DetailPlan";
import DetailExternalSession from "@/app/shared/components/session/DetailExternalSession";
import DetailBests from "@/app/shared/components/session/DetailBests";
import { MetricGrid } from "@/app/shared/components/session/MetricGrid";
import { safeText } from "@/app/shared/components/session/sessionUtils";
import type {
  SessionCardItem,
  SessionItem,
  PlanStatus,
} from "@/app/shared/components/session/SessionCard";

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

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * SessionDetail - centralny "master" komponent pre obsah rozbalenej SessionCard.
 *
 * Rozhoduje ktore sekcie sa zobrazia na zaklade planId/activityId kombinacie:
 *  - len planId            -> len Plan sekcia (editovatelna, plne manage akcie)
 *  - len activityId        -> len Activity sekcia
 *  - planId AJ activityId  -> obe sekcie pod sebou (Plan hore ako read-only-ish
 *                              historia + Activity dole), s jemnymi labelmi
 *                              "Plán" / "Realita" nad kazdou sekciou.
 *
 * Samotne PlanSessionDetail a ActivitySessionDetail ostavaju samostatne komponenty
 * (maju vlastnu domenovu logiku a pouzivaju sa aj mimo tejto karty - napr.
 * ActivitySessionDetail v bests/review kontextoch). Tento komponent je cisto
 * orchestracna vrstva nad nimi.
 */
export function DetailSession({
  variant,
  item,
  hasPlan,
  hasActivity,
  resolvedPlan,
  planLookupLoading,
  onOpenActivity,
  showPlanDebug,
  showAdvanced,
  onRefreshPlan,
  onDiscard,
  planRescheduleUI,
}: {
  variant: ComponentVariant;
  item: SessionCardItem;
  hasPlan: boolean;
  hasActivity: boolean;
  resolvedPlan: DailyPlanSession | null;
  planLookupLoading: boolean;
  onOpenActivity?: (activityId: number) => void;
  showPlanDebug: boolean;
  showAdvanced: boolean;
  onRefreshPlan?: () => void;
  onDiscard?: (sessionId: number) => void;
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
  const [isProcessing, setIsProcessing] = useState(false);

  const [showMatchUI, setShowMatchUI] = useState(false);
  const [selectedActivityId, setSelectedActivityId] = useState<number | "">("");

  if (item.kind === "external") {
    return <DetailExternalSession variant={variant} item={item as any} />;
  }

  if (item.kind === "bests") {
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

    return (
      <DetailBests
        item={item as any}
        kpiBlock={kpiBlock}
        hasKpis={hasKpis}
        compactChart={compactChart}
        onOpenActivity={onOpenActivity}
      />
    );
  }

  // --- kind === "session" ---
  const session = item as SessionItem;

  const kpis = Array.isArray(session.kpis) ? session.kpis : [];
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

  // Zlúčenie plánových dát - buď priamo z item (kalendárová cesta),
  // alebo z resolvedPlan (dotiahnuté podľa activityId, napr. na Activities stránke).
  // item.id sa prepisuje na skutočné plan DB id (session.id je inak kompozitný card id).
  const planForDetail: SessionItem | null = hasPlan
    ? session.planId != null
      ? ({ ...session, id: session.planId } as SessionItem)
      : resolvedPlan
        ? ({
            ...session,
            id: resolvedPlan.id ?? session.id,
            kind: "session",
            planId: resolvedPlan.id ?? null,
            status: (resolvedPlan.status as PlanStatus) ?? "planned",
            planDur:
              resolvedPlan.duration_min != null
                ? `${resolvedPlan.duration_min} min`
                : null,
            planIntensity: resolvedPlan.intensity ?? null,
            planNotes: resolvedPlan.notes ?? null,
            planRaw: resolvedPlan,
            planStructure: resolvedPlan.structure ?? null,
            dateIso: resolvedPlan.plan_date ?? session.dateIso,
          } as SessionItem)
        : null
    : null;

  const isFuture =
    !!planForDetail?.dateIso && planForDetail.dateIso >= todayIso();

  if (process.env.NODE_ENV !== "production") {
    console.log("[SessionDetail][debug]", {
      cardId: item.id,
      hasPlan,
      hasActivity,
      sessionPlanId: session.planId,
      sessionActivityId: session.activityId,
      sessionStatus: session.status,
      planForDetailId: planForDetail?.id,
      planForDetailStatus: planForDetail?.status,
    });
  }

  const handlePostpone = async (sessionId: string | number) => {
    if (!userId || isProcessing) return;
    setIsProcessing(true);
    try {
      await apiPatchDailySessionStatus(userId, Number(sessionId), {
        status: "postponed",
      });
      toast.success(t("common.done") || "Uložené");
      if (onRefreshPlan) onRefreshPlan();
    } catch (e) {
      toast.error(t("common.error") || "Chyba");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUnmatch = async (sessionId: string | number) => {
    if (!userId || isProcessing) return;
    setIsProcessing(true);
    try {
      await apiPatchDailySessionStatus(userId, Number(sessionId), {
        unmatch: true,
      });
      toast.success(t("common.done") || "Uložené");
      if (onRefreshPlan) onRefreshPlan();
    } catch (e) {
      toast.error(t("common.error") || "Chyba");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMatchSave = async () => {
    if (!userId || !planForDetail?.planId || !selectedActivityId) return;

    setIsProcessing(true);
    try {
      await apiPatchDailySessionStatus(userId, Number(planForDetail.planId), {
        activity_id: Number(selectedActivityId),
      });

      toast.success(t("sessions.matchModal.success") || "Spárované");
      setShowMatchUI(false);
      if (onRefreshPlan) onRefreshPlan();
    } catch (error) {
      toast.error(t("sessions.matchModal.error") || "Chyba");
    } finally {
      setIsProcessing(false);
    }
  };

  const showBothLabels = hasPlan && hasActivity;

  return (
    <div className="space-y-4">
      {/* --- SEKCIA PLÁNU (ak existuje) --- */}
      {hasPlan && planForDetail && (
        <div className="space-y-3">
          {showBothLabels && (
            <div className="flex items-center gap-3 pt-1">
              <span className="text-[11px] uppercase tracking-wider font-semibold opacity-50">
                {t("sessions.detail.labelPlan") || "Plán"}
              </span>
              <span className="flex-1 h-px bg-white/10" />
            </div>
          )}

          {showAdvanced && (
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 flex flex-col gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="text-[11px] uppercase tracking-wider opacity-50 font-semibold">
                {t("sessions.card.managePlan") || "Správa tréningu"}
              </div>

              <div className="flex flex-wrap gap-2">
                {/* Presunúť - len ked este nie je sparovane a den je v buducnosti */}
                {planRescheduleUI && !hasActivity && isFuture && (
                  <Button
                    size="xs"
                    variant="primary"
                    disabled={isProcessing}
                    onClick={() => {
                      planRescheduleUI.setShow((s) => !s);
                      setShowMatchUI(false);
                    }}
                  >
                    {planRescheduleUI.show
                      ? t("common.cancel") || "Zrušiť"
                      : t("sessions.card.actions.reschedule") || "Presunúť"}
                  </Button>
                )}

                {planForDetail.status === "planned" && !hasActivity && (
                  <Button
                    size="xs"
                    variant="secondary"
                    disabled={isProcessing}
                    onClick={() => handlePostpone(planForDetail.planId as any)}
                  >
                    {t("sessions.card.actions.postpone") || "Odložiť"}
                  </Button>
                )}

                {/* Spárovať - dostupné kedykoľvek nie je (ešte/už) spárované */}
                {!hasActivity &&
                  (planForDetail.status === "planned" ||
                    planForDetail.status === "missed" ||
                    planForDetail.status === "postponed") && (
                    <Button
                      size="xs"
                      variant="primary"
                      disabled={isProcessing}
                      onClick={() => {
                        setShowMatchUI((s) => !s);
                        if (planRescheduleUI) planRescheduleUI.setShow(false);
                      }}
                    >
                      {showMatchUI
                        ? t("common.cancel") || "Zrušiť"
                        : t("sessions.card.actions.match") || "Spárovať"}
                    </Button>
                  )}

                {/* Zrušiť spárovanie - vždy dostupné, ked je spárované */}
                {hasActivity && (
                  <Button
                    size="xs"
                    variant="danger"
                    disabled={isProcessing}
                    onClick={() => handleUnmatch(planForDetail.planId as any)}
                  >
                    {t("sessions.card.actions.unmatch") || "Zrušiť spárovanie"}
                  </Button>
                )}

                {planForDetail.status === "postponed" &&
                  !hasActivity &&
                  onDiscard && (
                    <Button
                      size="xs"
                      variant="danger"
                      disabled={isProcessing}
                      className="ml-auto"
                      onClick={() => {
                        if (
                          window.confirm(
                            t("sessions.card.actions.discardConfirm") ||
                              "Naozaj chcete tento tréning vymazať zo zásobníka?",
                          )
                        ) {
                          onDiscard(Number(planForDetail.planId));
                        }
                      }}
                    >
                      {t("sessions.card.actions.discard") || "Zahodiť"}
                    </Button>
                  )}
              </div>

              {planRescheduleUI?.show && !hasActivity && isFuture && (
                <div className="mt-2 p-2 bg-black/20 rounded-lg border border-black/40 animate-in fade-in slide-in-from-top-1">
                  <SelectField
                    value={planRescheduleUI.pendingDate}
                    onChange={(e) =>
                      planRescheduleUI.onSelect(String(e.target.value))
                    }
                    options={planRescheduleUI.options}
                    variant="editable"
                  />

                  <div className="mt-2 text-[11px] opacity-60">
                    {t("sessions.card.reschedule.current")}{" "}
                    {shortSkDate(planRescheduleUI.currentDate)} ·{" "}
                    {shortSkDay(planRescheduleUI.currentDate)}
                  </div>
                </div>
              )}

              {showMatchUI && !hasActivity && (
                <div className="mt-2 p-3 bg-black/20 rounded-lg border border-black/40 animate-in fade-in slide-in-from-top-1">
                  <ActivitySelectorDate
                    userId={userId}
                    defaultDateIso={
                      planForDetail.dateIso ||
                      new Date().toISOString().slice(0, 10)
                    }
                    sports={[planForDetail.sport as any]}
                    value={selectedActivityId}
                    onChange={(val) => setSelectedActivityId(val)}
                  />

                  <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-white/5">
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => setShowMatchUI(false)}
                      disabled={isProcessing}
                    >
                      {t("common.cancel") || "Zrušiť"}
                    </Button>
                    <Button
                      variant="primary"
                      size="xs"
                      onClick={handleMatchSave}
                      disabled={!selectedActivityId || isProcessing}
                    >
                      {isProcessing
                        ? t("common.saving") || "Ukladám..."
                        : t("common.save") || "Uložiť"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          <PlanSessionDetail
            variant={variant}
            item={planForDetail as any}
            showPlanDebug={showPlanDebug}
            showAdvanced={showAdvanced}
          />
        </div>
      )}

      {/* --- SEKCIA AKTIVITY (ak existuje) --- */}
      {hasActivity && (
        <div className="space-y-3">
          {showBothLabels && (
            <div className="flex items-center gap-3 pt-2">
              <span className="text-[11px] uppercase tracking-wider font-semibold opacity-50">
                {t("sessions.detail.labelReality") || "Realita"}
              </span>
              <span className="flex-1 h-px bg-white/10" />
            </div>
          )}

          <ActivitySessionDetail
            item={session as any}
            kpiBlock={kpiBlock}
            hasKpis={hasKpis}
            compactChart={compactChart}
            onOpenActivity={onOpenActivity}
          />
        </div>
      )}
    </div>
  );
}

export default DetailSession;
