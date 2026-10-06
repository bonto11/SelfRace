"use client";

import { useMemo } from "react";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { useT } from "@/app/shared/i18n/useT";

import {
  WIDGET_LOADING_CENTER,
  WIDGET_ERROR_TEXT,
  WIDGET_ERROR_SUB,
  WIDGET_INFO_TEXT,
  WIDGET_LIST,
  WIDGET_LIST_ITEM,
  WIDGET_TRUNCATE,
} from "@/app/shared/ui/tokens";

import { type HealthLogRecord } from "@/app/features/coach/api/users_health_log";
import { useCoachData } from "@/app/shared/components/dataProviders/CoachDataProvider";
import { useEnsure } from "@/app/shared/components/dataProviders/useCachedResource";

type Props = {
  onOpenDetail?: () => void;
};

const NO_LOGS: HealthLogRecord[] = [];

export default function WidgetAthleteHealth({ onOpenDetail }: Props) {
  const { userId, isChecking } = useUserId();
  const t = useT();

  const { healthActive } = useCoachData();
  useEnsure(healthActive);
  const logs: HealthLogRecord[] = healthActive.data ?? NO_LOGS;
  const loading = !healthActive.loaded;
  const error =
    healthActive.error && healthActive.data === undefined
      ? t("healthLog.widget.errorFailedLoad")
      : null;

  const maxSeverity = useMemo(() => {
    if (!logs.length) return 0;
    return Math.max(...logs.map((l) => l.severity || 0));
  }, [logs]);

  let accent: "none" | "danger" | "warning" | "success" = "success";
  if (maxSeverity >= 7) accent = "danger";
  else if (maxSeverity >= 4) accent = "warning";
  else if (maxSeverity > 0) accent = "none";

  return (
    <WidgetCard
      title={t("healthLog.widget.title")}
      tooltip={t("healthLog.widget.tooltip")}
      accent={accent}
      onOpen={onOpenDetail}
      interactive={!!onOpenDetail}
      minH={160}
    >
      {loading || isChecking ? (
        <div className={WIDGET_LOADING_CENTER}>
          <LoadingSpinner size="widget" />
        </div>
      ) : error ? (
        <div className={WIDGET_ERROR_TEXT}>
          {t("widget.errorLoad")}
          <div className={WIDGET_ERROR_SUB}>{error}</div>
        </div>
      ) : !userId ? (
        <div className={WIDGET_INFO_TEXT}>{t("widget.missingUserId")}</div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-emerald-400/80 gap-2 mt-4">
          <span className="text-2xl">✅</span>
          <span className="text-sm font-medium tracking-wide uppercase">
            {t("healthLog.widget.allGood")}
          </span>
        </div>
      ) : (
        <ul className={WIDGET_LIST}>
          {logs.map((log, i) => {
            const isIllness = log.event_type === "illness";
            const icon = isIllness ? "🦠" : log.event_type === "fatigue" ? "🔋" : "🩹";
            const typeName = t(`healthLog.types.${log.event_type}` as any) || log.event_type;
            
            return (
              <li key={log.id || i} className={WIDGET_LIST_ITEM}>
                <span className="shrink-0">{icon}</span>
                <span className={WIDGET_TRUNCATE}>
                  <strong>{typeName}</strong> ({log.severity}/10)
                  {log.notes ? ` - ${log.notes}` : ""}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </WidgetCard>
  );
}