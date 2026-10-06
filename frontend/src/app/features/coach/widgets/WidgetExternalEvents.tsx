"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CalendarClock } from "lucide-react";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import { useCoachData } from "@/app/shared/components/dataProviders/CoachDataProvider";
import { useEnsure } from "@/app/shared/components/dataProviders/useCachedResource";
import { fmt, useT } from "@/app/shared/i18n/useT";
import { useSettings } from "@/app/shared/i18n/SettingsProvider";
import type { ExternalEvent } from "@/app/features/coach/types/externalEvents";
import { Caption, ListRow, SportTile, WidgetEmpty, WidgetLoading } from "@/app/shared/ui/widget/WidgetParts";
import { coachInfo } from "@/app/features/coach/utils/coachInfo";

const isoToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function WidgetExternalEvents() {
  const router = useRouter();
  const t = useT();
  const { settings } = useSettings() as any;
  const locale = settings?.language === "en" ? "en-GB" : "sk-SK";
  const { externalEvents } = useCoachData();
  useEnsure(externalEvents);
  const loading = !externalEvents.loaded;
  const failed = !!externalEvents.error && externalEvents.data === undefined;

  const ui = useMemo(() => {
    const events = externalEvents.data ?? [];
    const today = isoToday();
    const weekly = events.filter((e) => (e.recurrence_kind ?? "weekly") === "weekly");
    // jednorazové len tie, čo ešte len prídu – minulé plán už neovplyvnia
    const singles = events
      .filter((e) => e.recurrence_kind === "single" && e.single_date && e.single_date >= today)
      .sort((a, b) => String(a.single_date).localeCompare(String(b.single_date)));
    const weeklySorted = [...weekly].sort((a, b) => (a.weekday || 0) - (b.weekday || 0));
    return { weekly: weeklySorted, singles, list: [...singles.slice(0, 1), ...weeklySorted].slice(0, 3) };
  }, [externalEvents.data]);

  const when = (e: ExternalEvent) => {
    if (e.recurrence_kind === "single" && e.single_date) {
      return new Date(e.single_date).toLocaleDateString(locale, { day: "numeric", month: "numeric" });
    }
    // 1. 1. 2024 bol pondelok → weekday 1–7 na názov dňa bez vlastného prekladu
    const d = new Date(2024, 0, Math.min(7, Math.max(1, e.weekday || 1)));
    const day = d.toLocaleDateString(locale, { weekday: "short" });
    return e.start_time_local ? `${day} ${e.start_time_local.slice(0, 5)}` : day;
  };

  return (
    <WidgetCard
      title={t("externalEvents.widget.title")}
      tooltip={coachInfo(t, "external")}
      accent="none"
      interactive
      minH={140}
      onOpen={() => router.push("/coach/external")}
    >
      {loading ? (
        <WidgetLoading />
      ) : failed ? (
        <WidgetEmpty icon={AlertTriangle} tone="danger" text={t("externalEvents.errors.loadFailed")} />
      ) : !ui.list.length ? (
        <WidgetEmpty icon={CalendarClock} text={t("externalEvents.widget.emptyHint")} />
      ) : (
        <div className="flex flex-col gap-1.5 text-left">
          {ui.list.map((e, i) => (
            <ListRow key={e.id ?? i} icon={<SportTile sport={e.sport} />} label={e.title} value={when(e)} />
          ))}
          <Caption>
            {fmt(t("externalEvents.widget.summary"), { weekly: ui.weekly.length, singles: ui.singles.length })}
          </Caption>
        </div>
      )}
    </WidgetCard>
  );
}
