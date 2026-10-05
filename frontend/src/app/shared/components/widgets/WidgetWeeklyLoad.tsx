// src/app/shared/components/widgets/WidgetWeeklyLoad.tsx
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
import { DayBars, DeltaChip, StatusChip, type Tone } from "@/app/shared/components/widgets/parts/WidgetParts";

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
  const status: { tone: Tone; label: string } | null =
    diffPct == null
      ? null
      : diffPct > 20
        ? { tone: "warn", label: t("weeklyLoad.status.muchMore") }
        : diffPct < -20
          ? { tone: "info", label: t("weeklyLoad.status.muchLess") }
          : { tone: "good", label: t("weeklyLoad.status.similar") };

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
      tooltip={t("weeklyLoad.widget.tooltip")}
      accent={status?.tone === "warn" ? appColors.statusWarning : "none"}
      onOpen={onOpenDetail}
      interactive={!!onOpenDetail}
      minH={160}
    >
      {loading ? (
        <div className={WIDGET_LOADING_WRAP} aria-live="polite">
          <LoadingSpinner size="widget" />
        </div>
      ) : (
        <div className="flex flex-col gap-2 text-left">
          <div className="text-[11px] uppercase tracking-wide" style={{ color: appColors.textMuted }}>
            {t("activityWidgets.last7days")}
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-extrabold tabular-nums leading-none" style={{ color: appColors.textPrimary }}>
              {h}
            </span>
            <span className="text-base" style={{ color: appColors.textSecondary }}>h</span>
            <span className="text-4xl font-extrabold tabular-nums leading-none ml-1" style={{ color: appColors.textPrimary }}>
              {String(m).padStart(2, "0")}
            </span>
            <span className="text-base" style={{ color: appColors.textSecondary }}>min</span>
          </div>
          {diffPct != null && status ? (
            <DeltaChip pct={diffPct} tone={status.tone} suffix={` ${t("activityWidgets.vsPrevWeek")}`} />
          ) : null}
          {daily.length ? (
            <>
              <DayBars values={daily} ghost={ghost} labels={dayLabels} color={appColors.chartRecoveryMain} />
              <div className="text-[10px]" style={{ color: appColors.textMuted }}>
                {t("activityWidgets.ghostHint")}
              </div>
            </>
          ) : null}
          {status ? <StatusChip tone={status.tone} label={status.label} /> : null}
        </div>
      )}
    </WidgetCard>
  );
}
