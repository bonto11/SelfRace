// src/app/shared/components/widgets/WidgetStreak.tsx
"use client";

import { useEffect, useState } from "react";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { apiGetStreak, type StreakData } from "@/app/features/coach/api/coach_plan_daily";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import {
  WIDGET_LOADING_WRAP, WIDGET_VALUE_ROW,
  WIDGET_VALUE_PRIMARY, WIDGET_VALUE_UNIT, WIDGET_NOTE,
} from "@/app/shared/ui/tokens";
import { useT } from "@/app/shared/i18n/useT";

function WeekDots({ done, total }: { done: number; total: number }) {
  return (
    <div style={{ display: "flex", gap: 5, marginTop: 6, marginBottom: 2 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          width: 10, height: 10, borderRadius: "50%",
          backgroundColor: i < done ? "#4ade80" : "rgba(255,255,255,0.12)",
        }} />
      ))}
    </div>
  );
}

export default function WidgetStreak({ onOpenDetail }: { onOpenDetail?: () => void }) {
  const { userId } = useUserId();
  const t = useT();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<StreakData | null>(null);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    apiGetStreak(userId)
      .then((d) => { if (alive) setData(d); })
      .catch((e) => console.error("[WidgetStreak]", e))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [userId]);

  const current = data?.current_streak ?? 0;
  const best    = data?.best_streak ?? 0;
  const done    = data?.this_week_done ?? 0;
  const minSess = data?.min_sessions_per_week ?? 3;

  const streakColor = current === 0 ? appColors.textMuted
    : current >= 4 ? "#f97316" : "#4ade80";

  return (
    <WidgetCard
      title={t("streak.widget.title") as any}
      tooltip={t("streak.widget.tooltip") as any}
      accent="none"
      onOpen={onOpenDetail}
      interactive={!!onOpenDetail}
      minH={160}
    >
      {loading ? (
        <div className={WIDGET_LOADING_WRAP}><LoadingSpinner size="widget" /></div>
      ) : (
        <>
          <div className={WIDGET_VALUE_ROW} style={{ alignItems: "baseline", gap: 4 }}>
            <span style={{ fontSize: 22, marginRight: 2 }}>
              {current > 0 ? "🔥" : "💤"}
            </span>
            <span className={WIDGET_VALUE_PRIMARY} style={{ color: streakColor }}>
              {current}
            </span>
            <span className={WIDGET_VALUE_UNIT} style={{ color: streakColor }}>
              {t("streak.widget.weeks") as any}
            </span>
          </div>

          {best > 0 && (
            <p style={{ fontSize: 11, color: appColors.textMuted, marginTop: 2, opacity: 0.7 }}>
              {t("streak.widget.best") as any}: {best} {t("streak.widget.weeks") as any}
            </p>
          )}

          <WeekDots done={Math.min(done, minSess)} total={minSess} />
          <p className={WIDGET_NOTE}>
            {done >= minSess
              ? t("streak.widget.weekDone") as any
              : `${done}/${minSess} ${t("streak.widget.weekProgress") as any}`
            }
          </p>
        </>
      )}
    </WidgetCard>
  );
}