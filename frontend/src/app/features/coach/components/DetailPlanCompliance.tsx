// src/app/features/coach/components/DetailPlanCompliance.tsx
"use client";

import { useMemo, useState } from "react";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { useT } from "@/app/shared/i18n/useT";
import { 
  apiSaveDailyReschedule,
  apiPatchDailySessionStatus 
} from "@/app/features/coach/api/coach_plan_daily";
import { toast } from "@/app/shared/ui/components/Toast";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import SessionCard from "@/app/shared/components/session/SessionCard";
import { PAGE_GRID_2 } from "@/app/shared/ui/tokens/pageTokens";

// 🌟 Používame globálny provider namiesto vlastného API na GET
import { useCoachData } from "@/app/shared/components/dataProviders/CoachDataProvider";

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

/* ---------- card wrapper ---------- */
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

  const [saving, setSaving] = useState(false);

  // 🌟 Vytiahneme globálne dáta
  const { plan: { rows: globalRows }, loading: isGlobalLoading, refresh: refreshCoach } = useCoachData();

  // 🌟 Agregujeme compliance štatistiky zo SSOT (posledných 30 dní)
  const complianceData = useMemo(() => {
    if (!globalRows || !Array.isArray(globalRows)) return { stats: { done: 0, postponed: 0, missed: 0 }, postponedSessions: [] };

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysIso = thirtyDaysAgo.toISOString().slice(0, 10);

    const todayIso = new Date().toISOString().slice(0, 10);

    let done = 0;
    let postponed = 0;
    let missed = 0;
    const postponedArr: any[] = [];

    for (const r of globalRows) {
      const pDate = String(r.plan_date).slice(0, 10);
      
      // Zaujíma nás len posledných 30 dní až po dnešok (vrátane)
      if (pDate >= thirtyDaysIso && pDate <= todayIso) {
        if (r.status === "done") done++;
        if (r.status === "postponed") {
            postponed++;
            postponedArr.push(r);
        }
        if (r.status === "missed") missed++;
      }
    }

    // Sortneme odložené od najnovšieho
    postponedArr.sort((a, b) => String(b.plan_date).localeCompare(String(a.plan_date)));

    return {
      stats: { done, postponed, missed },
      postponedSessions: postponedArr
    };
  }, [globalRows]);


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
    if (!userId || !sessionId || !toDate || saving) return;
    setSaving(true);
    try {
      // 1. Uložíme nový dátum
      await apiSaveDailyReschedule(userId, [
        { id: sessionId, from_date: fromDate, to_date: toDate }
      ]);
      // 2. Musíme natvrdo zmeniť status z postponed späť na planned
      await apiPatchDailySessionStatus(userId, Number(sessionId), { status: "planned" });
      
      toast.success(t("common.moved"));
      
      // 🌟 Globálny refresh!
      refreshCoach(false); 
    } catch (e: any) {
      toast.error(t(e?.message as any) || t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  if (isGlobalLoading && !globalRows?.length) {
    return (
      <div className="flex justify-center p-12 w-full">
        <LoadingSpinner size="widget" />
      </div>
    );
  }

  const { stats, postponedSessions } = complianceData;

  return (
    <div className="flex flex-col gap-6 w-full">
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
              
              {/* Odložené */}
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

        {/* BANKA RESTOV / POSTPONED ZÁSOBNÍK */}
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
                  {postponedSessions.map((s: any) => {
                    // Zachovávame existujúcu podporu pre raw DB riadok vs JSON payload
                    const rawData = s.payload ?? s;

                    return (
                      <li key={s.id}>
                        <SessionCard
                          variant="calendar"
                          showAdvanced={true}
                          onRefreshPlan={() => refreshCoach(false)}
                          
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
                            title: rawData.title || rawData.sport,
                            dateIso: s.plan_date,
                            sport: rawData.sport,
                            notes: rawData.notes,
                            planDur: rawData.duration_min ? `${rawData.duration_min} min` : null,
                            planIntensity: rawData.intensity,
                            planRaw: s,
                            planStructure: rawData.structure ?? null,
                            kpis: [],
                          } as any}
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </Card>
        </div>

      </div>
    </div>
  );
}