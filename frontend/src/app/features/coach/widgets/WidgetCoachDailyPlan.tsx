"use client";

import { useMemo } from "react";
import { BedDouble, CalendarDays, HeartPulse } from "lucide-react";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { fmt, useT } from "@/app/shared/i18n/useT";
import { useSettings } from "@/app/shared/i18n/SettingsProvider";
import { useCoachData, type PlanRow } from "@/app/shared/components/dataProviders/CoachDataProvider";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { useDayMarks } from "@/app/features/calendar/hooks/useDayMarks";
import { useExternalPlanRows } from "@/app/features/coach/hooks/useExternalPlanRows";
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
import { localeTag } from "@/app/shared/i18n/locale";

type Props = {
  onOpenDetail?: () => void;
  title?: string;
};

/** lokálny dátum – toISOString by po polnoci posunul deň (UTC) */
function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// voľno = bez dĺžky (rovnaké pravidlo ako kalendár), externá aktivita nemusí mať dĺžku
const isWorkout = (r: PlanRow) =>
  String(r.session_type || "").toLowerCase() !== "rest" && (!!r.is_external || Number(r.duration_min) > 0);

export default function WidgetCoachDailyPlan({ onOpenDetail, title }: Props) {
  const t = useT();
  const { userId } = useUserId();
  const { settings } = useSettings() as any;
  const locale = localeTag(settings?.language);
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

  // aktuálny týždeň po–ne: vidno aj splnené a zmeškané, nielen to, čo príde
  const week = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const mon = new Date(today);
    mon.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    const dates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(mon);
      d.setDate(mon.getDate() + i);
      return d;
    });
    return { dates, start: isoLocal(dates[0]), end: isoLocal(dates[6]), today: isoLocal(today) };
  }, []);
  const marks = useDayMarks(week.start, week.end);
  // externé aktivity (futbal v stredu) – v pláne nie sú, zlučujú sa pri čítaní
  const externalRows = useExternalPlanRows(userId, week.start, week.end);

  const ui = useMemo(() => {
    const titles = {
      plan: t("calendar.marks.plan"),
      activity: t("calendar.marks.activity"),
      done: t("calendar.marks.done"),
      missed: t("calendar.marks.missed"),
      postponed: t("calendar.marks.postponed"),
    };
    const days: StripDay[] = week.dates.map((d) => {
      const key = isoLocal(d);
      return {
        key,
        label: d.toLocaleDateString(locale, { weekday: "narrow" }),
        day: d.getDate(),
        marks: marks.get(key) ?? [],
        today: key === week.today,
        titles,
      };
    });
    const today = [
      ...planRows.filter((r) => String(r.plan_date).slice(0, 10) === week.today),
      ...externalRows.filter((r) => r.plan_date === week.today),
    ].filter(isWorkout);
    // splnené z naplánovaných (aktivity mimo plánu sa nerátajú)
    const planned = days.flatMap((d) => d.marks).filter((m) => m.kind !== "activity");
    const done = planned.filter((m) => m.kind === "done").length;
    return { today, days, done, total: planned.length, hasAnyPlan: planRows.length > 0 || externalRows.length > 0 };
  }, [planRows, externalRows, marks, week, locale, t]);

  const main = ui.today[0];
  const todayMin = ui.today.reduce((s, r) => s + (Number(r.duration_min) || 0), 0);
  const todayDone = ui.today.length > 0 && ui.today.every((r) => r.status === "done" || r.activity_id != null);

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
            {ui.total ? (
              <Caption>{fmt(t("coachWidgets.daily.weekDone"), { done: ui.done, total: ui.total })}</Caption>
            ) : null}
          </div>
        </div>
      )}
    </WidgetCard>
  );
}
