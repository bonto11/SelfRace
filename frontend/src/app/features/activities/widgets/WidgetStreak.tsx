"use client";

import { Flame, Moon } from "lucide-react";
import { useEnsure } from "@/app/shared/components/dataProviders/useCachedResource";
import { useActivityData } from "@/app/shared/components/dataProviders/ActivityDataProvider";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { WIDGET_LOADING_WRAP } from "@/app/shared/ui/tokens";
import { useT } from "@/app/shared/i18n/useT";
import { Caption, Hero, IconTile, Pill, Segments } from "@/app/shared/ui/widget/WidgetParts";
import { activityInfo } from "@/app/features/activities/utils/activityInfo";

export default function WidgetStreak({ onOpenDetail }: { onOpenDetail?: () => void }) {
  const t = useT();
  const { streak } = useActivityData();
  useEnsure(streak);

  const loading = !streak.loaded;
  const data = streak.data ?? null;
  const current = data?.current_streak ?? 0;
  const best = data?.best_streak ?? 0;
  const done = data?.this_week_done ?? 0;
  const minSess = data?.min_sessions_per_week ?? 3;
  const weekDone = done >= minSess;

  return (
    <WidgetCard
      title={t("streak.widget.title")}
      tooltip={activityInfo(t, "streak")}
      accent="none"
      onOpen={onOpenDetail}
      interactive={!!onOpenDetail}
      minH={160}
    >
      {loading ? (
        <div className={WIDGET_LOADING_WRAP}><LoadingSpinner size="widget" /></div>
      ) : (
        <div className="flex flex-col gap-3 text-left">
          <Hero
            icon={
              <IconTile
                icon={current > 0 ? Flame : Moon}
                color={current > 0 ? appColors.statusWarning : appColors.textMuted}
              />
            }
            value={current}
            unit={t("activityWidgets.weeksInRow")}
            sub={best > 0 ? `${t("activityWidgets.best")} ${best}` : undefined}
            right={weekDone ? <Pill tone="good" label={t("activityWidgets.done")} /> : null}
          />
          <div className="space-y-1.5">
            <Segments done={done} total={minSess} color={appColors.statusSuccess} />
            <Caption>
              {t("activityWidgets.thisWeek")} {Math.min(done, minSess)}/{minSess}
            </Caption>
          </div>
        </div>
      )}
    </WidgetCard>
  );
}
