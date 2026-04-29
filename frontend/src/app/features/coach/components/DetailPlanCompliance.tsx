// src/app/(protected)/coach/plan/compliance/page.tsx
"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { useT } from "@/app/shared/i18n/useT";
import { 
  apiGetPlanCompliance, 
  apiSaveDailyReschedule,
  apiPatchDailySessionStatus 
} from "@/app/features/coach/api/coach_plan_daily";
import { toast } from "@/app/shared/ui/components/Toast";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import SessionCard from "@/app/shared/components/session/SessionCard";
import { PAGE_GRID_2 } from "@/app/shared/ui/tokens/pageTokens";

import {
  PANEL_STACK,
  PANEL_PAD,
  PANEL_INNER_STACK,
  PANEL_SECTION_HEAD,
  PANEL_SECTION_TITLE,
  PANEL_SECTION_SUBTITLE,
  ACCORDION_FOOTER_BAR_MUTED,
} from "@/app/shared/ui/tokens";
import {
  SESSION_CARD,
  SESSION_CARD_STYLE,
} from "@/app/shared/ui/tokens/sessionCard";
import { appColors } from "@/app/shared/ui/theme/app_colors";

/* ---------- card wrapper (Tento zabezpečí ten správny tokenový dizajn) ---------- */
function Card({
  title,
  subtitle,
  children,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className={SESSION_CARD} style={SESSION_CARD_STYLE}>
      {(title || subtitle) && (
        <header className={[PANEL_PAD, PANEL_SECTION_HEAD].join(" ")}>
          <div className="min-w-0">
            {title && <div className={PANEL_SECTION_TITLE}>{title}</div>}
            {subtitle && (
              <div className={PANEL_SECTION_SUBTITLE}>{subtitle}</div>
            )}
          </div>
        </header>
      )}
      <div className={[PANEL_PAD, PANEL_INNER_STACK].join(" ")}>{children}</div>
      <div className={ACCORDION_FOOTER_BAR_MUTED} />
    </section>
  );
}

export default function DetailPlanCompliance() {
  const { userId } = useUserId();
  const t = useT();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const res = await apiGetPlanCompliance(userId);
      setData(res);
    } catch (err: any) {
      setError(t(err?.message as any));
    } finally {
      setLoading(false);
    }
  }, [userId, t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const planDates = useMemo(() => {
    const out: string[] = [];
    const base = new Date(); 
    for (let i = 0; i <= 7; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      out.push(d.toISOString().slice(0, 10));
    }
    return out;
  }, []);

  const handleReschedule = async ({ sessionId, fromDate, toDate }: any) => {
    if (!userId || !sessionId || !toDate) return;
    try {
      await apiSaveDailyReschedule(userId, [
        { id: sessionId, from_date: fromDate, to_date: toDate }
      ]);
      await apiPatchDailySessionStatus(userId, Number(sessionId), { status: "planned" });
      
      toast.success(t("common.moved"));
      loadData(); 
    } catch (e: any) {
      toast.error(t(e?.message as any) || t("common.error"));
    }
  };

  if (loading && !data) {
    return (
      <div className="flex justify-center p-12 w-full">
        <LoadingSpinner size="widget" />
      </div>
    );
  }

  const stats = data?.stats || { done: 0, postponed: 0, missed: 0 };
  const postponedSessions = data?.postponed_sessions || [];

  return (
    <div className="flex flex-col gap-6 w-full">
      {error && <div className="text-red-500 mb-4">{error}</div>}

      <div className={PAGE_GRID_2}>
        
        {/* STATISTIKY OBALENÉ V NOVOM CARDE */}
        <div className={PANEL_STACK}>
          <Card
            title={t("coachCompliance.stats.title")}
            subtitle={t("coachCompliance.stats.subtitle")}
          >
            <div className="space-y-3">
              {/* Odtrénované */}
              <div 
                className="flex justify-between items-center p-3 rounded-xl border"
                style={{ backgroundColor: `${appColors.statusSuccess}15`, borderColor: `${appColors.statusSuccess}33` }}
              >
                <span className="font-semibold" style={{ color: appColors.statusSuccess }}>
                  {t("coachCompliance.stats.completed")}
                </span>
                <span className="text-xl font-bold" style={{ color: appColors.statusSuccess }}>
                  {stats.done}
                </span>
              </div>
              
              {/* Odložené (šedé/priehľadné) */}
              <div className="flex justify-between items-center p-3 rounded-xl border border-white/5 bg-white/5">
                <span className="text-white/70 font-semibold">
                  {t("coachCompliance.stats.postponed")}
                </span>
                <span className="text-xl font-bold text-white/90">
                  {stats.postponed}
                </span>
              </div>

              {/* Zmeškané */}
              <div 
                className="flex justify-between items-center p-3 rounded-xl border"
                style={{ backgroundColor: `${appColors.statusError}15`, borderColor: `${appColors.statusError}33` }}
              >
                <span className="font-semibold" style={{ color: appColors.statusError }}>
                  {t("coachCompliance.stats.missed")}
                </span>
                <span className="text-xl font-bold" style={{ color: appColors.statusError }}>
                  {stats.missed}
                </span>
              </div>
            </div>
          </Card>
        </div>

        {/* BANKA RESTOV OBALENÁ V NOVOM CARDE */}
        <div className={PANEL_STACK}>
          <Card
            title={t("coachCompliance.bank.title")}
            subtitle={t("coachCompliance.bank.subtitle")}
          >
            <div className="space-y-3">
              {postponedSessions.length === 0 ? (
                <div className="p-4 border border-white/10 bg-white/5 rounded-xl text-center text-sm opacity-50 italic">
                  {t("coachCompliance.bank.empty")}
                </div>
              ) : (
                <ul className="space-y-3">
                  {postponedSessions.map((s: any) => (
                    <li key={s.id}>
                      <SessionCard
                        variant="calendar"
                        showAdvanced={true}
                        onRefreshPlan={loadData}
                        
                        planReschedule={{
                          enabled: true,
                          dates: planDates,
                          maxPerDay: 5, 
                          onChangeDate: handleReschedule
                        }}
                        
                        item={{
                          id: s.id,
                          kind: "plan",
                          status: s.status,
                          title: s.title || s.sport,
                          dateIso: s.plan_date,
                          sport: s.sport,
                          notes: s.notes,
                          planDur: s.duration_min ? `${s.duration_min} min` : null,
                          planIntensity: s.intensity,
                          planRaw: s,
                          planStructure: s.structure ?? null,
                          kpis: [],
                        } as any}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        </div>

      </div>
    </div>
  );
}