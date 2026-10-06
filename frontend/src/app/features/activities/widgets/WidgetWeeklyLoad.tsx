"use client";

import { useMemo } from "react";
import { useActivityData } from "@/app/shared/components/dataProviders/ActivityDataProvider";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import { minToHM } from "@/app/shared/utils/time";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { WIDGET_LOADING_WRAP } from "@/app/shared/ui/tokens";
import { useT } from "@/app/shared/i18n/useT";
import { useSettings } from "@/app/shared/i18n/SettingsProvider";
import { DayBars, DeltaPill, Hero, type Tone } from "@/app/shared/ui/widget/WidgetParts";
import { activityInfo } from "@/app/features/activities/utils/activityInfo";

export default function WeeklyLoadWidget({
  title,
  onOpenDetail,
}: {
  title?: string;
  onOpenDetail?: () => void;
}) {
  const { rolling7, loading } = useActivityData();
  const t = useT();
  const { settings } = useSettings() as any;
  const locale = settings?.language === "en" ? "en-GB" : "sk-SK";

  const r7 = rolling7?.("time");
  const totalLast = Number(r7?.last?.sum ?? 0);
  const totalPrev = Number(r7?.prev?.sum ?? 0);
  const { h, m } = useMemo(() => minToHM(totalLast), [totalLast]);

  const diffPct: number | null = useMemo(() => {
    if (!totalPrev && totalLast > 0) return 100;
    if (!totalPrev) return null;
    return ((totalLast - totalPrev) / totalPrev) * 100;
  }, [totalLast, totalPrev]);

  // > +20 % = rýchly nárast (riziko únavy), < −20 % = ľahší týždeň
  const tone: Tone | null =
    diffPct == null ? null : diffPct > 20 ? "warn" : diffPct < -20 ? "info" : "good";

  const daily = (r7?.last?.daily ?? []) as number[];
  const ghost = (r7?.prev?.daily ?? []) as number[];
  const dayLabels = useMemo(() => {
    const start = r7?.last?.range?.start ? new Date(r7.last.range.start) : null;
    return daily.map((_, i) => {
      if (!start || Number.isNaN(start.getTime())) return "";
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d.toLocaleDateString(locale, { weekday: "narrow" });
    });
  }, [r7?.last?.range?.start, daily.length, locale]);

  return (
    <WidgetCard
      title={title ?? t("weeklyLoad.widget.title")}
      tooltip={activityInfo(t, "load")}
      accent={tone === "warn" ? appColors.statusWarning : "none"}
      onOpen={onOpenDetail}
      interactive={!!onOpenDetail}
      minH={160}
    >
      {loading ? (
        <div className={WIDGET_LOADING_WRAP} aria-live="polite">
          <LoadingSpinner size="widget" />
        </div>
      ) : (
        <div className="flex flex-col gap-3 text-left">
          <Hero
            value={`${h} h ${String(m).padStart(2, "0")}`}
            unit="min"
            sub={t("activityWidgets.last7days")}
            right={diffPct != null && tone ? <DeltaPill pct={diffPct} tone={tone} /> : null}
          />
          {daily.length ? (
            <DayBars values={daily} ghost={ghost} labels={dayLabels} color={appColors.chartRecoveryMain} />
          ) : null}
        </div>
      )}
    </WidgetCard>
  );
}
