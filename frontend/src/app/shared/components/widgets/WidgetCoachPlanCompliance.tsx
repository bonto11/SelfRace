// src/app/shared/components/widgets/WidgetCoachPlanCompliance.tsx
"use client";

import { useT } from "@/app/shared/i18n/useT";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import { WIDGET_HEADLINE } from "@/app/shared/ui/tokens";

type Props = {
  onOpenDetail?: () => void;
};

export default function WidgetCoachPlanCompliance({ onOpenDetail }: Props) {
  const t = useT();

  // TODO: Neskôr napojiť na reálne dáta z API
  const hasData = true; 
  const stats = {
    done: 12,
    skipped: 3,
    missed: 1,
    total: 16
  };

  const successRate = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;

  return (
    <WidgetCard
      title={t("coachCompliance.widget.title")}
      tooltip={t("coachCompliance.widget.tooltip")}
      accent="none"
      onOpen={onOpenDetail}
      interactive={!!onOpenDetail}
      minH={190}
    >
      {!hasData ? (
        <div className="text-[13px] text-white/50 text-center py-4">
          {/* V prípade prázdnych dát môžeme pridať kľúč coachCompliance.stats.noData */}
          ---
        </div>
      ) : (
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
                <span className="text-white/80">{t("coachCompliance.stats.skipped")}</span>
              </div>
              <span className="font-bold text-gray-300">{stats.skipped}</span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-white/80">{t("coachCompliance.stats.missed")}</span>
              </div>
              <span className="font-bold text-red-400">{stats.missed}</span>
            </div>
          </div>
        </div>
      )}
    </WidgetCard>
  );
}