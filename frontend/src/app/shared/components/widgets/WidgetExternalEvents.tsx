// src/shared/components/widgets/WidgetExternalEvents.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import Pill from "@/app/shared/ui/components/Pill";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";

import { useUserId } from "@/app/shared/hooks/useUserId";
import { appColors } from "@/app/shared/theme/app_colors";
import {
  WIDGET_ROW_TOP_XS,
  WIDGET_META_TEXT,
  WIDGET_LOADING_LINE,
  WIDGET_EMPTY_HINT,
  WIDGET_ERROR_LINE_COLORED,
} from "@/app/shared/ui/tokens";

import { apiGetExternalEvents } from "@/app/features/coach/api/coach_external_events";
import type { ExternalEvent } from "@/app/features/coach/types/externalEvents";

type Stats = {
  total: number;
  weekly: number;
  singles_upcoming: number;
};

export default function WidgetExternalEvents() {
  const router = useRouter();
  const { userId } = useUserId();

  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let alive = true;

    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const events: ExternalEvent[] = await apiGetExternalEvents(userId);
        if (!alive) return;

        const now = new Date();
        const horizon = new Date();
        horizon.setDate(horizon.getDate() + 30);

        const singlesUpcoming = events.filter((ev) => {
          if (!ev.single_date) return false;
          const d = new Date(ev.single_date as string);
          return d >= now && d <= horizon;
        }).length;

        const weekly = events.filter(
          (ev) => (ev.recurrence_kind ?? "weekly") === "weekly"
        ).length;

        setStats({
          total: events.length,
          weekly,
          singles_upcoming: singlesUpcoming,
        });
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message ?? "Failed to load external events.");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [userId]);

  const accent = appColors.accentTeal;

  const label = (() => {
    if (!stats) return "No data";
    if (stats.total === 0) return "No external events";
    return `${stats.weekly} weekly · ${stats.singles_upcoming} upcoming singles`;
  })();

  const pillColor = appColors.textMuted;

  return (
    <WidgetCard
      title="External events"
      note="Externé športy a časové bloky, s ktorými plán počíta."
      accent={accent}
      interactive
      minH={120}
      onOpen={() => router.push("/coach/external")}
    >
      <div className={WIDGET_ROW_TOP_XS}>
        <Pill
          label={
            loading ? "Loading…" : stats ? `${stats.total} saved` : "No data"
          }
          color={pillColor}
        />
        <span className={WIDGET_META_TEXT}>{label}</span>
      </div>

      {err && <div className={WIDGET_ERROR_LINE_COLORED}>{err}</div>}

      {loading && (
        <div className={WIDGET_LOADING_LINE}>
          <LoadingSpinner size="button" /> Loading from DB…
        </div>
      )}

      {!loading && !err && (!stats || stats.total === 0) && (
        <div className={WIDGET_EMPTY_HINT}>
          Tap to add your first external event.
        </div>
      )}
    </WidgetCard>
  );
}
