// src/features/coach/components/WidgetExternalEvents.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import WidgetCard from "@/shared/components/ui/WidgetCard";
import Pill from "@/shared/components/ui/Pill";
import Button from "@/shared/components/ui/Button";
import LoadingSpinner from "@/shared/components/ui/LoadingSpinner";

import { useUserId } from "@/shared/hooks/useUserId";
import { THEME } from "@/shared/theme/tokens";

import {
  apiGetExternalEvents,
} from "@/features/coach/api/coach_external_events";
import type { ExternalEvent } from "@/features/coach/types/externalEvents";

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
          (ev) => (ev.recurrence_kind ?? "weekly") === "weekly",
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

  const accent = THEME?.chart?.other ?? THEME?.chart?.run ?? "#0EA5E9";

  const summaryLabel = (() => {
    if (!stats) return "No data";
    if (stats.total === 0) return "No external events";
    return `${stats.weekly} weekly · ${stats.singles_upcoming} upcoming singles`;
  })();

  const pillColor =
    stats && stats.total > 0
      ? THEME?.chart?.neutral ?? "#64748B"
      : THEME?.chart?.neutral ?? "#64748B";

  const goToDetail = () => {
    router.push("/coach/external");
  };

  return (
    <WidgetCard
      title="External events"
      note="Externé športy a udalosti, s ktorými plán počíta."
      accent={accent}
      interactive
      minH={140}
      onOpen={goToDetail}
    >
      <div className="flex items-center justify-between gap-2 text-xs">
        <Pill
          label={
            loading
              ? "Loading…"
              : stats
              ? `${stats.total} saved`
              : "No data"
          }
          color={pillColor}
        />
        <span className="text-[11px] opacity-80">{summaryLabel}</span>
      </div>

      {err && (
        <div className="mt-1 text-[11px] text-red-300 line-clamp-2">
          {err}
        </div>
      )}

      <div className="mt-4 flex items-center justify-end gap-2 text-xs">
        <Button size="xs" variant="primary" onClick={goToDetail}>
          Manage external events
        </Button>
      </div>

      {loading && (
        <div className="mt-2 text-[11px] opacity-80 inline-flex items-center gap-1">
          <LoadingSpinner size="button" /> Loading from DB…
        </div>
      )}
    </WidgetCard>
  );
}