// src/app/features/coach/components/SeasonPlanCard.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { fmt, useT } from "@/app/shared/i18n/useT";
import { useFeature } from "@/app/shared/state/featureFlagsStore";
import { TooltipIcon } from "@/app/shared/ui/components/Tooltip";
import { coachInfo } from "@/app/features/coach/utils/coachInfo";
import Pill from "@/app/shared/ui/components/Pill";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { PANEL_PAD, PANEL_SECTION_HEAD, PANEL_SECTION_TITLE, PANEL_SECTION_SUBTITLE } from "@/app/shared/ui/tokens";
import { SESSION_CARD, SESSION_CARD_STYLE } from "@/app/shared/ui/tokens/sessionCard";
import { apiGetSeasonPlan, seasonWeekFor, type SeasonPlan } from "@/app/features/coach/api/seasonPlan";
import { WeekCounts, loadColor, weekRange } from "@/app/features/coach/components/SeasonPlanEditor";

function todayIso(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Advisor denný plán: čo hovorí kostra obdobia o tomto týždni (téma, počty,
 * kľúčové tréningy). Bez plánu ponúkne jeho vytvorenie. Za prepínačom season_plan.
 */
export default function SeasonPlanCard() {
  const t = useT();
  const enabled = useFeature("season_plan");
  const { userId, trainerView } = useUserId();
  const [plan, setPlan] = useState<SeasonPlan | null | undefined>(undefined);

  useEffect(() => {
    if (!enabled || !userId) return;
    let alive = true;
    apiGetSeasonPlan(Number(userId))
      .then((p) => alive && setPlan(p))
      .catch(() => alive && setPlan(null));
    return () => {
      alive = false;
    };
  }, [enabled, userId]);

  if (!enabled || plan === undefined) return null;
  // tréner bez plánu zverenca nemá čo vidieť ani vytvoriť
  if (!plan && trainerView) return null;

  const today = todayIso();
  const week = seasonWeekFor(plan, today);
  const notStarted = !!plan && today < plan.start_date;
  const ended = !!plan && today > plan.end_date;

  return (
    <section className={SESSION_CARD} style={SESSION_CARD_STYLE}>
      <Link href="/coach/season" className="block">
        <header className={[PANEL_PAD, PANEL_SECTION_HEAD].join(" ")}>
          <div className="min-w-0 flex-1">
            <div className={PANEL_SECTION_TITLE}>🗺️ {plan ? plan.title : t("seasonPlan.card.emptyTitle")}</div>
            <div className={PANEL_SECTION_SUBTITLE}>
              {!plan
                ? t("seasonPlan.card.emptyText")
                : week
                  ? fmt(t("seasonPlan.card.weekOf"), { n: week.index, total: plan.weeks.length }) + ` · ${weekRange(week)}`
                  : notStarted
                    ? fmt(t("seasonPlan.card.startsOn"), { date: weekRange(plan.weeks[0]).split(" – ")[0] })
                    : ended
                      ? t("seasonPlan.card.ended")
                      : ""}
            </div>
          </div>
          {week ? <Pill label={t(`seasonPlan.load.${week.load}` as any)} color={loadColor(week.load)} outline /> : null}
          <TooltipIcon text={coachInfo(t, "season")} title={t("seasonPlan.title")} size={24} />
          <span className="shrink-0 text-sm" style={{ color: appColors.textMuted }}>
            ›
          </span>
        </header>
        {week ? (
          <div className={[PANEL_PAD, "pt-0 flex flex-col gap-1"].join(" ")}>
            <div className="text-sm font-semibold">{week.theme}</div>
            <WeekCounts w={week} />
            {week.key_sessions.length ? (
              <ul className="flex flex-col gap-0.5 mt-1">
                {week.key_sessions.map((k, i) => (
                  <li key={i} className="flex gap-2 text-xs">
                    <span className="opacity-50">•</span>
                    <span>{k}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </Link>
    </section>
  );
}
