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
import { PANEL_STACK } from "@/app/shared/ui/tokens";

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

  // Vypočítame si zoznam voľných dátumov na nasledujúcich 7 dní pre Reschedule funkciu
  const planDates = useMemo(() => {
    const out: string[] = [];
    const base = new Date(); 
    // Ponúkame presun od dneška na ďalších 7 dní
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
      // 1. Uložíme zmenu dátumu
      await apiSaveDailyReschedule(userId, [
        { id: sessionId, from_date: fromDate, to_date: toDate }
      ]);
      
      // 2. Musíme natvrdo zmeniť status zo 'skipped' späť na 'planned'
      await apiPatchDailySessionStatus(userId, Number(sessionId), { status: "planned" });
      
      toast.success(t("common.moved") || "Presunuté");
      loadData(); // Obnovíme dáta (Tréning zmizne z banky restov)
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

  const stats = data?.stats || { done: 0, skipped: 0, missed: 0 };
  const skippedSessions = data?.skipped_sessions || [];

  return (
    <div className="flex flex-col gap-6 w-full">
      {error && <div className="text-red-500 mb-4">{error}</div>}

      <div className={PAGE_GRID_2}>
        
        {/* STATISTIKY */}
        <div className={PANEL_STACK}>
          <div className="rounded-2xl border border-white/10 bg-[#121212] p-5 shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-2">
              {t("coachCompliance.stats.title")}
            </h2>
            <p className="text-sm opacity-60 mb-6">
              {t("coachCompliance.stats.subtitle")}
            </p>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <span className="text-emerald-400 font-semibold">
                  {t("coachCompliance.stats.completed")}
                </span>
                <span className="text-xl font-bold text-emerald-400">
                  {stats.done}
                </span>
              </div>
              
              <div className="flex justify-between items-center p-3 rounded-lg bg-gray-500/10 border border-gray-500/20">
                <span className="text-gray-300 font-semibold">
                  {t("coachCompliance.stats.skipped")}
                </span>
                <span className="text-xl font-bold text-gray-300">
                  {stats.skipped}
                </span>
              </div>

              <div className="flex justify-between items-center p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <span className="text-red-400 font-semibold">
                  {t("coachCompliance.stats.missed")}
                </span>
                <span className="text-xl font-bold text-red-400">
                  {stats.missed}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* BANKA RESTOV */}
        <div className={PANEL_STACK}>
          <div className="rounded-2xl border border-white/10 bg-[#121212] p-5 shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-2">
              {t("coachCompliance.bank.title")}
            </h2>
            <p className="text-sm opacity-60 mb-6">
              {t("coachCompliance.bank.subtitle")}
            </p>
            
            <div className="space-y-3">
              {skippedSessions.length === 0 ? (
                <div className="p-4 border border-white/10 bg-white/5 rounded-xl text-center text-sm opacity-50 italic">
                  {t("coachCompliance.bank.empty")}
                </div>
              ) : (
                <ul className="space-y-3">
                  {skippedSessions.map((s: any) => (
                    <li key={s.id}>
                      <SessionCard
                        variant="calendar"
                        showAdvanced={true}
                        onRefreshPlan={loadData} // Pre manuálne spárovanie (Activity selector modal)
                        
                        // 🌟 Pridanie Reschedule modulu priamo do banky restov
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
                          // Uložíme aj raw dáta pre vnútorný detail
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
          </div>
        </div>

      </div>
    </div>
  );
}