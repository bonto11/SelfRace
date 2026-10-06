"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import { useCoachData } from "@/app/shared/components/dataProviders/CoachDataProvider";
import MiniCalendar from "@/app/shared/ui/components/MiniCalendar";
import { fmt, useT } from "@/app/shared/i18n/useT";
import { NO_X_OVERFLOW } from "@/app/shared/ui/tokens/core";
import { WK } from "@/app/shared/ui/tokens/widgets";
import { Caption, Highlight, toneColor } from "@/app/shared/ui/widget/WidgetParts";
import { useDayMarks } from "@/app/features/calendar/hooks/useDayMarks";

type Props = {
  openHref?: string;
  perDayLimit?: number;
};

function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function WidgetActivitiesCalendar({ openHref = "/calendar", perDayLimit = 3 }: Props) {
  const router = useRouter();
  const t = useT();
  const { prefs, prefsLoaded } = useCoachData();

  // najvážnejšie hlásené zranenie – od 7/10 je plán pozastavený
  const injury = React.useMemo(() => {
    const list = (prefs as any)?.injuries;
    if (!prefsLoaded || !Array.isArray(list) || !list.length) return null;
    const max = list.reduce((p: any, c: any) => ((c?.severity || 0) > (p?.severity || 0) ? c : p), { severity: 0 });
    if (!(max?.severity > 0)) return null;
    const areaKey = `prefs.sections.injuriesSection.areas.${max.area}`;
    const area = t(areaKey as any);
    return { severity: max.severity as number, area: area === areaKey ? max.area : area };
  }, [prefs, prefsLoaded, t]);

  // rovnaký týždeň ako MiniCalendar (po–ne) – súčet splnených z naplánovaných
  const week = React.useMemo(() => {
    const mon = new Date();
    mon.setHours(0, 0, 0, 0);
    mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    return { start: isoLocal(mon), end: isoLocal(sun) };
  }, []);
  const marks = useDayMarks(week.start, week.end);
  const planned = Array.from(marks.values()).flat().filter((m) => m.kind !== "activity");
  const done = planned.filter((m) => m.kind === "done").length;

  const handleOpen = () => router.push(openHref);
  const severe = (injury?.severity ?? 0) >= 7;

  return (
    <WidgetCard
      title={t("calendar.widget.title")}
      tooltip={t("calendar.widget.tooltip")}
      onOpen={handleOpen}
      accent={severe ? toneColor("danger") : "none"}
      interactive
      minH={150}
      innerClassName={NO_X_OVERFLOW}
    >
      <div className={WK.stack}>
        {injury ? (
          <Highlight
            tone={severe ? "danger" : "warn"}
            text={`${t("common.injury.reported")} ${injury.area} (${injury.severity}/10) · ${
              severe ? t("common.injury.calendar") : t("common.injury.planAdjusted")
            }`}
          />
        ) : null}
        <MiniCalendar startFrom="monday" perDayLimit={perDayLimit} onOpen={handleOpen} />
        {planned.length ? (
          <Caption>{fmt(t("coachWidgets.daily.weekDone"), { done, total: planned.length })}</Caption>
        ) : null}
      </div>
    </WidgetCard>
  );
}
