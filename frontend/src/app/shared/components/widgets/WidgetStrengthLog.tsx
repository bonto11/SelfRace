// src/app/shared/components/widgets/WidgetStrengthLog.tsx
"use client";

import { useMemo, useState } from "react";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import Button from "@/app/shared/ui/components/Button";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { useT } from "@/app/shared/i18n/useT";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import {
  apiCreateStrengthSession,
  type StrengthSession,
} from "@/app/features/strength/api/strength_sessions";
import { useActivityData } from "@/app/shared/components/dataProviders/ActivityDataProvider";
import { useEnsure } from "@/app/shared/components/dataProviders/useCachedResource";
import { Dumbbell } from "lucide-react";
import { WIDGET_LOADING_WRAP } from "@/app/shared/ui/tokens";
import { Hero, IconTile } from "@/app/shared/components/widgets/parts/WidgetParts";
import { activityInfo } from "@/app/features/activities/utils/activityInfo";

function sessionVolume(s: StrengthSession): number {
  let v = 0;
  for (const ex of s.log?.exercises ?? [])
    for (const set of ex.sets ?? [])
      if (!set.is_warmup && set.weight_kg && set.reps)
        v += set.weight_kg * set.reps;
  return Math.round(v);
}

function daysAgo(iso: string): number {
  const d = new Date(`${iso}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((today.getTime() - d.getTime()) / 86400000);
}

const NO_SESSIONS: StrengthSession[] = [];

export default function WidgetStrengthLog({
  onOpenDetail,
  onOpenSession,
}: {
  onOpenDetail?: () => void;
  onOpenSession?: (sessionId: number) => void;
}) {
  const { userId } = useUserId();
  const t = useT();
  const [creating, setCreating] = useState(false);

  const { strengthSessions } = useActivityData();
  useEnsure(strengthSessions);
  const loading = !strengthSessions.loaded;
  const sessions: StrengthSession[] = strengthSessions.data ?? NO_SESSIONS;

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
      strengthSessions.setData((prev) => [created, ...(prev ?? [])]);
      onOpenSession?.(created.id);
    }
  };

  // posledný tréning ako jedna krátka veta; objem len keď je čo ukázať
  const lastText = last
    ? [
        lastDaysAgo === 0
          ? t("activityWidgets.lastToday")
          : t("activityWidgets.lastAgo").replace("{{n}}", String(lastDaysAgo)),
        lastVolume > 0 ? `${lastVolume.toLocaleString("sk-SK")} kg` : "",
      ]
        .filter(Boolean)
        .join(" · ")
    : t("strengthLog.widget.empty");

  return (
    <WidgetCard
      title={t("strengthLog.widget.title")}
      tooltip={activityInfo(t, "strength")}
      accent="none"
      onOpen={onOpenDetail}
      interactive={!!onOpenDetail}
      minH={160}
    >
      {loading ? (
        <div className={WIDGET_LOADING_WRAP}>
          <LoadingSpinner size="widget" />
        </div>
      ) : (
        <div className="flex flex-col gap-3 text-left">
          <Hero
            icon={<IconTile icon={Dumbbell} color={appColors.chartStrength} solid />}
            value={thisWeekCount}
            unit={t("strengthLog.widget.thisWeek")}
            sub={lastText}
          />
          <div>
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
        </div>
      )}
    </WidgetCard>
  );
}
