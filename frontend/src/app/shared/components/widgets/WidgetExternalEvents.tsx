// src/shared/components/widgets/WidgetExternalEvents.tsx
"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";

import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import Pill from "@/app/shared/ui/components/Pill";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";

import { useCoachData } from "@/app/shared/components/dataProviders/CoachDataProvider";
import { useEnsure } from "@/app/shared/components/dataProviders/useCachedResource";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import {
  WIDGET_ROW_TOP_XS,
  WIDGET_META_TEXT,
  WIDGET_LOADING_LINE,
  WIDGET_EMPTY_HINT,
  WIDGET_ERROR_LINE_COLORED,
} from "@/app/shared/ui/tokens";

import { useT } from "@/app/shared/i18n/useT";

type Stats = {
  total: number;
  weekly: number;
  singles_upcoming: number;
};

export default function WidgetExternalEvents() {
  const router = useRouter();
  const t = useT();

  const { externalEvents } = useCoachData();
  useEnsure(externalEvents);
  const loading = !externalEvents.loaded;
  const err =
    externalEvents.error && externalEvents.data === undefined
      ? t("externalEvents.errors.loadFailed")
      : null;

  const stats = useMemo<Stats | null>(() => {
    const events = externalEvents.data;
    if (!events) return null;

    const now = new Date();
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + 30);

    const singlesUpcoming = events.filter((ev) => {
      if (!ev.single_date) return false;
      const d = new Date(ev.single_date as string);
      return d >= now && d <= horizon;
    }).length;

    const weekly = events.filter(
      (ev) => (ev.recurrence_kind ?? "weekly") === "weekly",
    ).length;

    return {
      total: events.length,
      weekly,
      singles_upcoming: singlesUpcoming,
    };
  }, [externalEvents.data]);

  const summaryLabel = useMemo(() => {
    if (!stats) return t("common.noData");
    if (stats.total === 0) return t("externalEvents.widget.empty");
    
    return t("externalEvents.widget.summary")
      .replace("{{weekly}}", String(stats.weekly))
      .replace("{{singles}}", String(stats.singles_upcoming));
  }, [stats, t]);

  const pillLabel = useMemo(() => {
    if (loading) return t("common.loading");
    if (!stats) return t("common.noData");
    return t("externalEvents.widget.statusSaved").replace("{{count}}", String(stats.total));
  }, [loading, stats, t]);

  return (
    <WidgetCard
      title={t("externalEvents.widget.title")}
      tooltip={t("externalEvents.widget.tooltip")}
      accent="none"
      note={t("externalEvents.widget.note")}
      interactive
      minH={120}
      onOpen={() => router.push("/coach/external")}
    >
      <div className={WIDGET_ROW_TOP_XS}>
        <Pill
          label={pillLabel}
          color={appColors.textMuted}
        />
        <span className={WIDGET_META_TEXT}>{summaryLabel}</span>
      </div>

      {err && <div className={WIDGET_ERROR_LINE_COLORED}>{err}</div>}

      {loading && (
        <div className={WIDGET_LOADING_LINE}>
          <LoadingSpinner size="button" /> {t("externalEvents.widget.loadingFromDb")}
        </div>
      )}

      {!loading && !err && (!stats || stats.total === 0) && (
        <div className={WIDGET_EMPTY_HINT}>
          {t("externalEvents.widget.emptyHint")}
        </div>
      )}
    </WidgetCard>
  );
}