// src/app/features/coach/components/DetailPlanCompliance.tsx
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
import { fmtSecondsHMS } from "@/app/shared/utils/time";

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

function sportLabel(t: any, sport: string): string {
  const key = (sport || "other").toLowerCase();
  const translated = t(`common.sports.${key}` as any);

  // Ak preklad chýba, i18n zvyčajne vráti späť samotný kľúč (napr. "common.sports.snowshoe").
  // V tom prípade spravíme fallback: posledný segment kľúča, podčiarkovníky nahradíme
  // medzerou a prvé písmeno každého slova veľké (napr. "rock_climbing" -> "Rock Climbing").
  const looksUntranslated = translated === `common.sports.${key}` || !translated;

  if (looksUntranslated) {
    return key
      .split("_")
      .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
      .join(" ");
  }

  return translated;
}


export default function DetailPlanCompliance() {
  const { userId } = useUserId();
  const t = useT();

  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { refresh: refreshCoach } = useCoachData();

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
    if (!userId || !sessionId || !toDate || saving) return;
    setSaving(true);
    try {
      await apiSaveDailyReschedule(userId, [
        { id: sessionId, from_date: fromDate, to_date: toDate }
      ]);
      await apiPatchDailySessionStatus(userId, Number(sessionId), { status: "planned" });
      
      toast.success(t("common.moved"));
      await loadData();
      refreshCoach(false); 
    } catch (e: any) {
      toast.error(t(e?.message as any) || t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = async (sessionId: number) => {
    if (!userId || !sessionId || saving) return;
    setSaving(true);
    try {
      await apiPatchDailySessionStatus(userId, sessionId, { status: "missed" });
      toast.success(t("common.deleted"));
      await loadData();
      refreshCoach(false);
    } catch (e: any) {
       toast.error(t(e?.message as any) || t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex justify-center p-12 w-full">
        <LoadingSpinner size="widget" />
      </div>
    );
  }

  const stats = data?.stats || { done: 0, postponed: 0, skipped: 0, missed: 0 };
  const displayPostponedCount = stats.postponed || stats.skipped || 0;

  const unmatchedSummary: Array<{
    sport: string;
    count: number;
    distance_m: number;
    moving_time_s: number;
  }> = Array.isArray(data?.unmatched_summary) ? data.unmatched_summary : [];

  const postponedSessions = data?.postponed_sessions || data?.skipped_sessions || [];

  return (
    <div className="flex flex-col gap-6 w-full">
      {error && <div className="text-red-500 mb-4">{error}</div>}

      <div className={PAGE_GRID_2}>

        {/* STATISTIKY */}
        <div className={PANEL_STACK}>
          <Card
            title={t("coachCompliance.stats.title")}
            subtitle={t("coachCompliance.stats.subtitle")}
          >
            <div className="space-y-3">
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
              
              <div className="flex justify-between items-center p-3 rounded-xl border border-white/5 bg-white/5">
                <span className="text-white/70 font-semibold">
                  {t("coachCompliance.stats.postponed")}
                </span>
                <span className="text-xl font-bold text-white/90">
                  {displayPostponedCount}
                </span>
              </div>

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

          {unmatchedSummary.length > 0 && (
            <Card
              title={t("coachCompliance.unmatched.title")}
              subtitle={t("coachCompliance.unmatched.subtitle")}
            >
              <div className="space-y-2">
                {unmatchedSummary.map((row) => {
                  const km = row.distance_m / 1000;
                  const hasDistance = km > 0.05;
                  return (
                    <div
                      key={row.sport}
                      className="flex justify-between items-center p-3 rounded-xl border border-white/5 bg-white/5"
                    >
                      <span className="text-white/80 font-medium">
                        {sportLabel(t, row.sport)}
                      </span>
                      <span className="text-sm text-white/70 text-right">
                        {row.count} {t("coachCompliance.unmatched.activitiesUnit")}
                        {hasDistance && <> · {km.toFixed(1)} km</>}
                        {row.moving_time_s > 0 && <> · {fmtSecondsHMS(row.moving_time_s)}</>}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>

        {/* ZÁSOBNÍK ODLOŽENÝCH */}
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
                    const rawData = s.payload ?? s;

                    return (
                      <li key={s.id}>
                        <SessionCard
                          variant="calendar"
                          showAdvanced={true}
                          onRefreshPlan={() => {
                            loadData();
                            refreshCoach(false);
                          }}
                          onDiscard={() => handleDiscard(s.id)}
                          
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
