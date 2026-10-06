"use client";

import { useT } from "@/app/shared/i18n/useT";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { WIDGET_HEADLINE, WIDGET_CENTER_SPINNER } from "@/app/shared/ui/tokens";
import { useCoachData } from "@/app/shared/components/dataProviders/CoachDataProvider";
import { useEnsure } from "@/app/shared/components/dataProviders/useCachedResource";

type Props = { onOpenDetail?: () => void; };

export default function WidgetCoachPlanCompliance({ onOpenDetail }: Props) {
  const t = useT();
  const { loading: isGlobalLoading, compliance } = useCoachData();
  useEnsure(compliance);
  const data = compliance.data ?? null;
  const localLoading = !compliance.loaded;

  if (localLoading || isGlobalLoading) return (
    <WidgetCard title={t("coachCompliance.widget.title")} accent="none">
      <div className={WIDGET_CENTER_SPINNER}><LoadingSpinner size="widget" /></div>
    </WidgetCard>
  );

  const stats = data?.stats || { done: 0, postponed: 0, skipped: 0, missed: 0 };
  const displayPostponedCount = stats.postponed || stats.skipped || 0;

  const unmatchedSummary: Array<{ count: number }> = Array.isArray(data?.unmatched_summary)
    ? data.unmatched_summary
    : [];
  const unmatchedCount = unmatchedSummary.reduce((sum, r) => sum + (r.count || 0), 0);

  const total = stats.done + displayPostponedCount + stats.missed;
  const successRate = total > 0 ? Math.round((stats.done / total) * 100) : 0;

  return (
    <WidgetCard
      title={t("coachCompliance.widget.title")}
      tooltip={t("coachCompliance.widget.tooltip")}
      accent="none"
      onOpen={onOpenDetail}
      interactive={!!onOpenDetail}
      minH={190}
    >
      <div className="flex flex-col gap-3">
        <div className={WIDGET_HEADLINE}>
          {t("coachCompliance.stats.successRate")}: {successRate} %
        </div>

        <div className="flex flex-col gap-2 mt-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-white/80">{t("coachCompliance.stats.completed")}</span>
            </div>
            <span className="font-bold text-white">{stats.done}</span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-gray-400" />
              <span className="text-white/80">{t("coachCompliance.stats.postponed")}</span>
            </div>
            <span className="font-bold text-gray-300">{displayPostponedCount}</span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-white/80">{t("coachCompliance.stats.missed")}</span>
            </div>
            <span className="font-bold text-red-400">{stats.missed}</span>
          </div>

          {unmatchedCount > 0 && (
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-400" />
                <span className="text-white/80">{t("coachCompliance.stats.unmatched")}</span>
              </div>
              <span className="font-bold text-blue-300">{unmatchedCount}</span>
            </div>
          )}
        </div>
      </div>
    </WidgetCard>
  );
}
