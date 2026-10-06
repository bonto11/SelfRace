"use client";

import { useMemo } from "react";
import { CalendarRange } from "lucide-react";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import { getSportColor } from "@/app/shared/ui/components/SportBadge";
import { useT } from "@/app/shared/i18n/useT";
import { useCoachData } from "@/app/shared/components/dataProviders/CoachDataProvider";
import type { WeeklyPlanLatest, WeeklyPlanWeek } from "@/app/features/coach/api/coach_plan_weekly";
import { toDate } from "@/app/shared/utils/time";
import AiUsageWarningBanner from "@/app/features/billing/components/AiUsageWarningBanner";
import {
  Hero,
  IconTile,
  Pill,
  ProgressRow,
  WidgetEmpty,
  WidgetLoading,
  type Tone,
} from "@/app/shared/ui/widget/WidgetParts";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { coachInfo, fmtMinutes, phaseLabel } from "@/app/features/coach/utils/coachInfo";
import { WK } from "@/app/shared/ui/tokens/widgets";

type Props = { onOpenDetail?: () => void };

type SportRow = { sport: string; act: number; plan: number };

function findCurrentWeek(weeks: WeeklyPlanWeek[]): WeeklyPlanWeek | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (const w of weeks) {
    const s = toDate(w.week_start);
    const e = toDate(w.week_end);
    if (!s || !e) continue;
    const ss = new Date(s);
    const ee = new Date(e);
    ss.setHours(0, 0, 0, 0);
    ee.setHours(0, 0, 0, 0);
    if (today >= ss && today <= ee) return w;
  }
  return weeks.find((w) => w.week_index === 1) ?? weeks[0] ?? null;
}

function buildUi(plan: WeeklyPlanLatest | null) {
  if (!plan?.weeks?.length) return null;
  const weeks = [...plan.weeks].sort((a, b) => (a.week_index || 0) - (b.week_index || 0));
  const cur = findCurrentWeek(weeks);
  const ps = cur?.planned_stats || {};
  const as = cur?.actual_stats || {};
  // porovnávame čas, nie km – sila a plávanie km nemajú, čas sa dá sčítať
  const sports: SportRow[] = [
    { sport: "run", act: as.run_time_min || 0, plan: ps.run_time_min || 0 },
    { sport: "ride", act: as.bike_time_min || 0, plan: ps.bike_time_min || 0 },
    { sport: "swim", act: as.swim_time_min || 0, plan: ps.swim_time_min || 0 },
    { sport: "strength", act: as.strength_time_min || 0, plan: ps.strength_time_min || 0 },
  ].filter((s) => s.plan > 0 || s.act > 0);
  const act = sports.reduce((s, r) => s + r.act, 0);
  const planned = sports.reduce((s, r) => s + r.plan, 0);
  return {
    index: cur?.week_index ?? 1,
    total: weeks.length,
    phase: cur?.load_phase ?? null,
    sports,
    pct: planned > 0 ? Math.round((act / planned) * 100) : null,
  };
}

export default function WidgetCoachWeeklyPlan({ onOpenDetail }: Props) {
  const t = useT();
  const {
    weekly: { plan, loading },
  } = useCoachData();
  const ui = useMemo(() => buildUi(plan), [plan]);

  const tone: Tone = ui?.pct == null ? "neutral" : ui.pct >= 100 ? "good" : "info";

  return (
    <WidgetCard
      title={t("coachWeekly.widget.title")}
      tooltip={coachInfo(t, "weekly")}
      accent="none"
      onOpen={onOpenDetail}
      interactive={!!onOpenDetail}
      minH={170}
    >
      {loading ? (
        <WidgetLoading />
      ) : !ui ? (
        <WidgetEmpty icon={CalendarRange} text={t("coachWeekly.widget.emptyText")}>
          <AiUsageWarningBanner />
        </WidgetEmpty>
      ) : (
        <div className={WK.stack}>
          <Hero
            icon={<IconTile icon={CalendarRange} color={appColors.chartRecoveryMain} />}
            value={ui.index}
            unit={`/ ${ui.total} ${t("coachWidgets.weekly.weeks")}`}
            sub={phaseLabel(t, ui.phase)}
            right={ui.pct != null ? <Pill tone={tone} label={`${ui.pct} %`} /> : null}
          />
          {ui.sports.length ? (
            <div className="space-y-2">
              {ui.sports.slice(0, 3).map((s) => (
                <ProgressRow
                  key={s.sport}
                  icon={<SportTileMini sport={s.sport} />}
                  label={t(`common.sports.${s.sport === "ride" ? "bike" : s.sport}` as any)}
                  done={s.act}
                  total={s.plan}
                  color={getSportColor(s.sport)}
                  value={`${fmtMinutes(s.act)} / ${fmtMinutes(s.plan)}`}
                />
              ))}
            </div>
          ) : null}
        </div>
      )}
    </WidgetCard>
  );
}

/** v riadku stačí bodka vo farbe športu – dlaždica by bola príliš veľká */
function SportTileMini({ sport }: { sport: string }) {
  return <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: getSportColor(sport) }} />;
}
