// src/app/features/coach/components/DetailWeeklyPlan.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { useUserId } from "@/app/shared/hooks/useUserId";
import {
  apiGetLatestWeeklyPlan,
  type WeeklyPlanLatest,
  type WeeklyPlanWeek,
} from "@/app/features/coach/api/coach_plan_weekly";
import { useT } from "@/app/shared/i18n/useT";

import {
  PANEL_STACK,
  PANEL_PAD,
  PANEL_INNER_STACK,
  PANEL_SECTION_HEAD,
  PANEL_SECTION_TITLE,
  PANEL_SECTION_SUBTITLE,
  PANEL_PREVIEW,
  PANEL_ACTIONS_INLINE,
  ACCORDION_FOOTER_BAR_MUTED,
  PANEL_BAR_TRACK,
  PANEL_BAR_FILL,
  PANEL_BAR_TRACK_STYLE,
  PANEL_PHASE_PILL_STYLE,
  PANEL_PHASE_BAR_STYLE,
} from "@/app/shared/ui/tokens";

import {
  SESSION_CARD,
  SESSION_CARD_STYLE,
  SESSION_SUBCARD,
  SESSION_SUBCARD_STYLE,
  SESSION_PILL,
} from "@/app/shared/ui/tokens/sessionCard";

/* ---------- helpers ---------- */

type PhaseKey = "base" | "build" | "peak" | "recovery" | "other";

function formatDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("sk-SK", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function phaseKey(load_phase?: string | null): PhaseKey {
  const l = (load_phase || "").toLowerCase();
  if (l.startsWith("base")) return "base";
  if (l.startsWith("build")) return "build";
  if (l.startsWith("peak")) return "peak";
  if (l.startsWith("recovery") || l.startsWith("deload")) return "recovery";
  return "other";
}

/* ---------- card wrapper ---------- */

function Card({ title, subtitle, children, headRight }: { title?: React.ReactNode; subtitle?: React.ReactNode; children: React.ReactNode; headRight?: React.ReactNode; }) {
  return (
    <section className={SESSION_CARD} style={SESSION_CARD_STYLE}>
      {(title || subtitle || headRight) && (
        <header className={[PANEL_PAD, PANEL_SECTION_HEAD].join(" ")}>
          <div className="min-w-0">
            {title && <div className={PANEL_SECTION_TITLE}>{title}</div>}
            {subtitle && <div className={PANEL_SECTION_SUBTITLE}>{subtitle}</div>}
          </div>
          {headRight && <div>{headRight}</div>}
        </header>
      )}
      <div className={[PANEL_PAD, PANEL_INNER_STACK].join(" ")}>{children}</div>
      <div className={ACCORDION_FOOTER_BAR_MUTED} />
    </section>
  );
}

export default function DetailWeeklyPlan() {
  const { userId } = useUserId();
  const t = useT();
  const [plan, setPlan] = useState<WeeklyPlanLatest | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await apiGetLatestWeeklyPlan(userId);
        if (alive) setPlan(r ?? null);
      } catch (e: any) {
        if (alive) setError(t(e?.message as any) || t("coach.weekly.errorLoad"));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [userId, t]);

  const view = useMemo(() => {
    if (!plan?.weeks?.length) return { weeksSorted: [], rangeLabel: null, totalKm: 0, totalMin: 0, phaseCounts: {} as any, maxKm: 0 };
    
    const weeksSorted = [...plan.weeks].sort((a, b) => (a.week_index || 0) - (b.week_index || 0));
    
    const firstStr = formatDate(weeksSorted.find(w => w.week_start)?.week_start);
    const lastStr = formatDate([...weeksSorted].reverse().find(w => w.week_end)?.week_end);
    
    let totalKm = 0, totalMin = 0, maxKm = 0;
    const phaseCounts: any = {};
    
    for (const w of weeksSorted) {
      const km = Number(w.planned_km || 0);
      totalKm += km;
      totalMin += Number(w.planned_minutes || 0);
      if (km > maxKm) maxKm = km;
      
      const pk = phaseKey(w.load_phase);
      phaseCounts[pk] = (phaseCounts[pk] || 0) + 1;
    }
    
    return { 
      weeksSorted, 
      rangeLabel: firstStr && lastStr ? `${firstStr} – ${lastStr}` : firstStr, 
      totalKm, 
      totalMin, 
      phaseCounts, 
      maxKm 
    };
  }, [plan]);

  // Helper na preklad detailnej fázy v zozname (Base Aerobic, Build 1...)
  const getPhaseLabel = (phaseStr?: string | null) => {
    if (!phaseStr) return "?";
    const safeKey = phaseStr.toLowerCase().replace(/ /g, "_");
    const key = `common.phases.${safeKey}`;
    const translated = (t as any)(key);
    return translated === key ? phaseStr : translated;
  };

  const getWeekLabel = () => {
    const w = t("common.weeksSelect.count1");
    return w.charAt(0).toUpperCase() + w.slice(1);
  };

  if (!userId) return <Card title={t("coachWeekly.title")} subtitle={t("common.errors.missingUserAuth")}><div className={PANEL_PREVIEW}>{t("common.errors.checkLogin")}</div></Card>;
  if (loading) return <section className={SESSION_CARD} style={SESSION_CARD_STYLE}><div className={[PANEL_PAD, "grid place-items-center"].join(" ")}><LoadingSpinner size="widget" /></div></section>;
  if (error || !plan || !view.weeksSorted.length) return <Card title={t("coachWeekly.title")} subtitle={t("coach.weekly.noPlanTitle")}><div className={PANEL_PREVIEW}>{error ?? t("coach.weekly.noPlanDesc")}</div></Card>;

  const weeksCount = view.weeksSorted.length;
  const totalHours = Math.round((view.totalMin / 60) * 10) / 10;
  const unitKm = t("common.units.km");
  const unitH = t("common.units.hour");

  return (
    <div className={PANEL_STACK}>
      <Card
        title={t("coach.weekly.overviewTitle")}
        subtitle={<>{t("coach.weekly.overviewSubtitle")}{view.rangeLabel && <span className="block">{t("coach.weekly.range")}: {view.rangeLabel}</span>}</>}
        headRight={
          <div className="text-right text-xs opacity-80">
            <div>{t("coachDaily.widget.daysCount")}: <b>{weeksCount}</b></div>
            <div>{t("coach.weekly.totalVolume")}: <b>{Math.round(view.totalKm)} {unitKm} / {totalHours} {unitH}</b></div>
          </div>
        }
      >
        <div className={PANEL_ACTIONS_INLINE}>
          {(Object.keys(view.phaseCounts) as PhaseKey[]).filter(k => view.phaseCounts[k] > 0).map(k => (
            <div key={k} className={SESSION_PILL} style={PANEL_PHASE_PILL_STYLE[k]}>
              <span className="opacity-90">{t(`coach.weekly.phases.${k}`)}</span>
              <span className="font-semibold tabular-nums">{view.phaseCounts[k]}×</span>
            </div>
          ))}
        </div>
      </Card>

      <Card title={t("coach.weekly.weeksTitle")} subtitle={t("coach.weekly.weeksSubtitle")}>
        <div className={PANEL_STACK}>
          {view.weeksSorted.map((w: WeeklyPlanWeek) => {
            const pk = phaseKey(w.load_phase);
            const km = Number(w.planned_km || 0);
            const hours = w.planned_minutes ? Math.round((w.planned_minutes / 60) * 10) / 10 : null;
            const widthPct = view.maxKm > 0 ? Math.max(6, Math.min(100, (km / view.maxKm) * 100)) : 0;
            
            return (
              <div key={w.week_index} className={SESSION_SUBCARD} style={SESSION_SUBCARD_STYLE}>
                <div className={[PANEL_PAD, PANEL_INNER_STACK].join(" ")}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] uppercase tracking-wide opacity-70">
                         {getWeekLabel()} {w.week_index}
                      </span>
                      <span className={SESSION_PILL} style={PANEL_PHASE_PILL_STYLE[pk]}>
                        {getPhaseLabel(w.load_phase)}
                      </span>
                    </div>
                    <div className="text-[11px] opacity-70">{formatDate(w.week_start)} – {formatDate(w.week_end)}</div>
                  </div>
                  
                  <div className="text-sm font-semibold">{w.goal || w.focus || t("coach.weekly.noGoalShort")}</div>
                  
                  {w.focus && (
                    <div className="text-xs opacity-80">
                       {t("coachWeekly.widget.labelFocus")}: {w.focus}
                    </div>
                  )}

                  <div className={PANEL_INNER_STACK}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="opacity-70">{t("coach.weekly.plannedVolume")}</span>
                      <span className="font-semibold">
                        {km ? `${km} ${unitKm}` : "—"}
                        {hours ? ` · ${hours} ${unitH}` : ""}
                      </span>
                    </div>
                    <div className={PANEL_BAR_TRACK} style={PANEL_BAR_TRACK_STYLE}>
                      <div className={PANEL_BAR_FILL} style={{ ...PANEL_PHASE_BAR_STYLE[pk], width: `${widthPct}%` }} />
                    </div>
                  </div>
                  
                  {w.notes && <div className="text-xs italic opacity-85">{w.notes}</div>}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}