// src/app/shared/components/widgets/WidgetStreak.tsx
"use client";

import { Flame, Moon } from "lucide-react";
import { useEnsure } from "@/app/shared/components/dataProviders/useCachedResource";
import { useActivityData } from "@/app/shared/components/dataProviders/ActivityDataProvider";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import { WIDGET_LOADING_WRAP } from "@/app/shared/ui/tokens";
import { useT } from "@/app/shared/i18n/useT";
import { StatusChip } from "@/app/shared/components/widgets/parts/WidgetParts";

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
  const Icon = current > 0 ? Flame : Moon;

  return (
    <WidgetCard
      title={t("streak.widget.title")}
      tooltip={t("streak.widget.tooltip")}
      accent="none"
      onOpen={onOpenDetail}
      interactive={!!onOpenDetail}
      minH={160}
    >
      {loading ? (
        <div className={WIDGET_LOADING_WRAP}><LoadingSpinner size="widget" /></div>
      ) : (
        <div className="flex flex-col gap-2 text-left">
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center justify-center w-10 h-10 rounded-xl shrink-0"
              style={{ background: appColors.surfaceSolid, border: `1px solid ${appColors.surfaceCardBorder}` }}
            >
              <Icon size={20} color={current > 0 ? appColors.statusWarning : appColors.textMuted} />
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-4xl font-extrabold tabular-nums leading-none" style={{ color: appColors.textPrimary }}>
                {current}
              </span>
              <span className="text-sm" style={{ color: appColors.textSecondary }}>
                {t("streak.widget.weeks")}
              </span>
            </div>
          </div>
          {best > 0 ? (
            <div className="text-[11px]" style={{ color: appColors.textMuted }}>
              {t("streak.widget.best")}: {best} {t("streak.widget.weeks")}
            </div>
          ) : null}

          {/* tento týždeň: jeden dielik = jeden tréning do cieľa */}
          <div>
            <div className="text-[11px] mb-1" style={{ color: appColors.textSecondary }}>
              {t("activityWidgets.thisWeek")}: {Math.min(done, minSess)}/{minSess}
            </div>
            <div className="flex gap-1.5">
              {Array.from({ length: minSess }).map((_, i) => (
                <div
                  key={i}
                  className="flex-1 h-2 rounded-full"
                  style={{ background: i < done ? appColors.statusSuccess : appColors.surfaceCardBorder }}
                />
              ))}
            </div>
          </div>
          {weekDone ? (
            <StatusChip tone="good" label={t("streak.widget.weekDone")} />
          ) : (
            <div className="text-[11px]" style={{ color: appColors.textMuted }}>
              {t("activityWidgets.streakLeft").replace("{{n}}", String(minSess - done))}
            </div>
          )}
        </div>
      )}
    </WidgetCard>
  );
}
