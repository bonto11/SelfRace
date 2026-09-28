// src/app/shared/components/widgets/WidgetStrengthLog.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import Button from "@/app/shared/ui/components/Button";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { useT } from "@/app/shared/i18n/useT";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import {
  apiListStrengthSessions,
  apiCreateStrengthSession,
  type StrengthSession,
} from "@/app/features/activities/api/strength_sessions";
import {
  WIDGET_LOADING_WRAP,
  WIDGET_VALUE_ROW,
  WIDGET_VALUE_PRIMARY,
  WIDGET_VALUE_UNIT,
  WIDGET_NOTE,
} from "@/app/shared/ui/tokens";

function sessionVolume(s: StrengthSession): number {
  let v = 0;
  for (const ex of s.log?.exercises ?? [])
    for (const set of ex.sets ?? [])
      if (!set.is_warmup && set.weight_kg && set.reps) v += set.weight_kg * set.reps;
  return Math.round(v);
}

function daysAgo(iso: string): number {
  const d = new Date(`${iso}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((today.getTime() - d.getTime()) / 86400000);
}

export default function WidgetStrengthLog({
  onOpenDetail,
  onOpenSession,
}: {
  onOpenDetail?: () => void;
  onOpenSession?: (sessionId: number) => void;
}) {
  const { userId } = useUserId();
  const t = useT();
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [sessions, setSessions] = useState<StrengthSession[]>([]);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    apiListStrengthSessions(userId, { weeks_back: 4, limit: 30 })
      .then((rows) => {
        if (alive) setSessions(rows);
      })
      .catch((e) => console.error("[WidgetStrengthLog]", e))
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [userId]);

  const last = sessions[0] ?? null;
  const lastVolume = last ? sessionVolume(last) : 0;
  const lastDaysAgo = last ? daysAgo(last.session_date) : null;

  const thisWeekCount = useMemo(() => {
    const now = new Date();
    const day = (now.getDay() + 6) % 7; // pondelok = 0
    const monday = new Date(now);
    monday.setDate(now.getDate() - day);
    const mondayIso = monday.toISOString().slice(0, 10);
    return sessions.filter((s) => s.session_date >= mondayIso).length;
  }, [sessions]);

  const handleQuickCreate = async () => {
    if (!userId || creating) return;
    setCreating(true);
    const created = await apiCreateStrengthSession(userId, {});
    setCreating(false);
    if (created) {
      setSessions((prev) => [created, ...prev]);
      onOpenSession?.(created.id);
    }
  };

  const valueColor =
    lastDaysAgo == null
      ? appColors.textMuted
      : lastDaysAgo <= 2
        ? "#4ade80"
        : lastDaysAgo <= 6
          ? appColors.textPrimary
          : appColors.statusWarning;

  return (
    <WidgetCard
      title={t("strengthLog.widget.title") as any}
      tooltip={t("strengthLog.widget.tooltip") as any}
      accent="none"
      onOpen={onOpenDetail}
      interactive={!!onOpenDetail}
      minH={170}
    >
      {loading ? (
        <div className={WIDGET_LOADING_WRAP}>
          <LoadingSpinner size="widget" />
        </div>
      ) : (
        <>
          <div className={WIDGET_VALUE_ROW} style={{ alignItems: "baseline", gap: 4 }}>
            <span style={{ fontSize: 22, marginRight: 2 }}>🏋️</span>
            <span className={WIDGET_VALUE_PRIMARY} style={{ color: valueColor }}>
              {thisWeekCount}
            </span>
            <span className={WIDGET_VALUE_UNIT} style={{ color: valueColor }}>
              {t("strengthLog.widget.thisWeek") as any}
            </span>
          </div>

          {last ? (
            <p style={{ fontSize: 11, color: appColors.textMuted, marginTop: 4, opacity: 0.8 }}>
              {t("strengthLog.widget.last") as any}:{" "}
              {lastDaysAgo === 0
                ? (t("strengthLog.widget.today") as any)
                : `${lastDaysAgo} ${t("strengthLog.widget.daysAgo") as any}`}
              {lastVolume > 0 ? ` · ${lastVolume} kg` : ""}
            </p>
          ) : (
            <p className={WIDGET_NOTE}>{t("strengthLog.widget.empty") as any}</p>
          )}

          <div className="mt-3">
            <Button
              size="xs"
              variant="primary"
              onClick={(e: any) => {
                e?.stopPropagation?.();
                handleQuickCreate();
              }}
              disabled={creating}
            >
              {creating ? <LoadingSpinner size="button" /> : `+ ${t("strengthLog.widget.logNow")}`}
            </Button>
          </div>
        </>
      )}
    </WidgetCard>
  );
}