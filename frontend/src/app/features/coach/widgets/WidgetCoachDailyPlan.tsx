"use client";

import { useMemo } from "react";
import { BedDouble, CalendarDays, HeartPulse } from "lucide-react";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { getSportColor } from "@/app/shared/ui/components/SportBadge";
import { fmt, useT } from "@/app/shared/i18n/useT";
import { useSettings } from "@/app/shared/i18n/SettingsProvider";
import { useCoachData, type PlanRow } from "@/app/shared/components/dataProviders/CoachDataProvider";
import AiUsageWarningBanner from "@/app/features/billing/components/AiUsageWarningBanner";
import {
  Caption,
  Hero,
  IconTile,
  Pill,
  SportTile,
  WeekStrip,
  WidgetEmpty,
  WidgetLoading,
  type StripDay,
} from "@/app/shared/ui/widget/WidgetParts";
import { coachInfo } from "@/app/features/coach/utils/coachInfo";
import { WK } from "@/app/shared/ui/tokens/widgets";

type Props = {
  onOpenDetail?: () => void;
  title?: string;
};

/** lokálny dátum – toISOString by po polnoci posunul deň (UTC) */
function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const isWorkout = (r: PlanRow) => String(r.session_type || "").toLowerCase() !== "rest";

export default function WidgetCoachDailyPlan({ onOpenDetail, title }: Props) {
  const t = useT();
  const { settings } = useSettings() as any;
  const locale = settings?.language === "en" ? "en-GB" : "sk-SK";
  const {
    plan: { rows: planRows, loading: planLoading },
    prefs,
    loading: coachLoading,
  } = useCoachData();
  const loading = coachLoading || planLoading;

  // najvážnejšie hlásené zranenie z nastavení – od 7/10 je plán pozastavený
  const injury = useMemo(() => {
    const list = Array.isArray(prefs?.injuries) ? prefs.injuries : [];
    const max = list.reduce((p: any, c: any) => ((c?.severity || 0) > (p?.severity || 0) ? c : p), null);
    return max && max.severity > 0 ? (max.severity as number) : 0;
  }, [prefs?.injuries]);

  const ui = useMemo(() => {
    const byDate = new Map<string, PlanRow[]>();
    for (const r of planRows) {
      const d = String(r.plan_date).slice(0, 10);
      if (!byDate.has(d)) byDate.set(d, []);
      byDate.get(d)!.push(r);
    }
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const days: StripDay[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const rows = (byDate.get(isoLocal(d)) ?? []).filter(isWorkout);
      const main = rows[0];
      days.push({
        label: d.toLocaleDateString(locale, { weekday: "narrow" }),
        color: main ? getSportColor(String(main.sport || "other").toLowerCase()) : null,
        done: rows.length > 0 && rows.every((r) => r.status === "done"),
        missed: rows.some((r) => r.status === "missed"),
        today: i === 0,
      });
    }
    const today = (byDate.get(isoLocal(start)) ?? []).filter(isWorkout);
    const weekCount = days.filter((d) => d.color).length;
    return { today, days, weekCount, hasAnyPlan: planRows.length > 0 };
  }, [planRows, locale]);

  const main = ui.today[0];
  const todayMin = ui.today.reduce((s, r) => s + (Number(r.duration_min) || 0), 0);
  const todayDone = ui.today.length > 0 && ui.today.every((r) => r.status === "done");

  return (
    <WidgetCard
      title={title ?? t("coachDaily.widget.title")}
      tooltip={coachInfo(t, "daily")}
      accent={injury >= 7 ? appColors.statusError : "none"}
      onOpen={onOpenDetail}
      interactive={!!onOpenDetail}
      minH={170}
    >
      {loading ? (
        <WidgetLoading />
      ) : !ui.hasAnyPlan ? (
        <WidgetEmpty icon={CalendarDays} text={t("coachDaily.widget.missingData")}>
          <AiUsageWarningBanner />
        </WidgetEmpty>
      ) : (
        <div className={WK.stack}>
          {main ? (
            <Hero
              size="md"
              icon={<SportTile sport={main.sport} />}
              value={main.title || t(`common.sports.${main.sport}` as any)}
              sub={[
                todayMin ? `${todayMin} ${t("common.units.min")}` : null,
                ui.today.length > 1 ? fmt(t("coachWidgets.daily.more"), { n: ui.today.length - 1 }) : null,
              ]
                .filter(Boolean)
                .join(" · ")}
              right={
                injury > 0 ? (
                  <Pill tone={injury >= 7 ? "danger" : "warn"} icon={HeartPulse} label={`${injury}/10`} />
                ) : todayDone ? (
                  <Pill tone="good" label={t("coachWidgets.daily.done")} />
                ) : (
                  <Pill tone="info" label={t("coachWidgets.daily.today")} />
                )
              }
            />
          ) : (
            <Hero
              size="md"
              icon={<IconTile icon={BedDouble} color={appColors.textSecondary} />}
              value={t("coachWidgets.daily.rest")}
              sub={t("coachWidgets.daily.restSub")}
              right={
                injury > 0 ? (
                  <Pill tone={injury >= 7 ? "danger" : "warn"} icon={HeartPulse} label={`${injury}/10`} />
                ) : null
              }
            />
          )}
          <div className="space-y-1.5">
            <WeekStrip days={ui.days} />
            <Caption>{fmt(t("coachWidgets.daily.next7"), { n: ui.weekCount })}</Caption>
          </div>
        </div>
      )}
    </WidgetCard>
  );
}
