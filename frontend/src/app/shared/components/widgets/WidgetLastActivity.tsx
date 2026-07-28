// src/app/shared/components/widgets/WidgetLastActivity.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { apiFetchRange } from "@/app/features/activities/api/activities_summary";
import type { ActivityRow } from "@/app/features/activities/types/activities";
import SportBadge from "@/app/shared/ui/components/SportBadge";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { useT } from "@/app/shared/i18n/useT";

import {
  WIDGET_CARD,
  WIDGET_CARD_STYLE,
  WIDGET_CARD_INTERACTIVE,
  WIDGET_INNER,
  WIDGET_TITLE,
  WIDGET_HINT,
  WIDGET_HINT_STYLE,
  WIDGET_LOADING_CENTER,
  WIDGET_EMPTY_TEXT,
  WIDGET_ERROR_TEXT,
  WIDGET_ERROR_TEXT_STYLE,
  WIDGET_KV_GRID,
  WIDGET_KV_LABEL,
  WIDGET_KV_VALUE,
} from "@/app/shared/ui/tokens";

type Props = {
  /** Zavolá sa po kliknutí na widget, s ID poslednej aktivity. */
  onOpenDetail: (activityId: number) => void;
  /** Koľko dní dozadu hľadať poslednú aktivitu (default 60). */
  lookbackDays?: number;
};

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function prettySkDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("sk-SK", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

/**
 * Widget zobrazujúci poslednú aktivitu (naprieč všetkými športmi).
 * Klik zavolá onOpenDetail(activityId) — presmerovanie rieši rodič
 * (activities/page.tsx), rovnako ako pri ostatných widgetoch.
 *
 * 🔍 PREDPOKLAD (over si to): ActivityRow má pole `id` alebo `activity_id`
 * pre ID aktivity a `distance_str`/`distanceStr`, `time_str`/`timeStr` pre
 * zobrazenie. Nevidel som `activities/utils/activity.ts`
 * (normalizeActivityRow), takže mapovanie nižšie skús preveriť — je
 * schválne na jednom mieste (premenné activityId/distanceStr/timeStr/title),
 * aby sa dalo ľahko opraviť, ak sa názvy polí nezhodujú.
 */
export default function WidgetLastActivity({
  onOpenDetail,
  lookbackDays = 60,
}: Props) {
  const { userId } = useUserId();
  const t = useT();
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    setLoading(true);
    setError(null);
    apiFetchRange(userId, isoDaysAgo(lookbackDays), todayIso())
      .then((r) => {
        if (alive) setRows(r);
      })
      .catch((e: any) => {
        if (alive)
          setError(
            t(e?.message as any) || t("common.errors.loadFailed" as any),
          );
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [userId, lookbackDays, t]);

  // apiFetchRange vracia zoradené vzostupne podľa dátumu -> posledný prvok
  // je najnovšia aktivita.
  const last = useMemo(
    () => (rows.length > 0 ? rows[rows.length - 1] : null),
    [rows],
  );

  const activityId = (last as any)?.id ?? (last as any)?.activity_id ?? null;
  const distanceStr =
    (last as any)?.distance_str ?? (last as any)?.distanceStr ?? null;
  const timeStr = (last as any)?.time_str ?? (last as any)?.timeStr ?? null;
  const title = (last as any)?.title ?? (last as any)?.name ?? null;

  const handleClick = () => {
    if (activityId != null) onOpenDetail(Number(activityId));
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!activityId}
      className={[WIDGET_CARD, WIDGET_CARD_INTERACTIVE, "text-left w-full"].join(
        " ",
      )}
      style={WIDGET_CARD_STYLE}
    >
      <div className={WIDGET_INNER}>
        <div className="flex items-center justify-between gap-2">
          <div className={WIDGET_TITLE}>
            {t("activities.lastActivity.title" as any) || "Posledná aktivita"}
          </div>
          {last?.sport && <SportBadge sport={last.sport as any} />}
        </div>

        {loading && (
          <div className={WIDGET_LOADING_CENTER}>
            <LoadingSpinner size="widget" />
          </div>
        )}

        {!loading && error && (
          <div className={WIDGET_ERROR_TEXT} style={WIDGET_ERROR_TEXT_STYLE}>
            {error}
          </div>
        )}

        {!loading && !error && !last && (
          <div className={WIDGET_EMPTY_TEXT}>
            {t("activities.lastActivity.empty" as any) ||
              "Zatiaľ žiadna aktivita."}
          </div>
        )}

        {!loading && !error && last && (
          <>
            <div className={WIDGET_HINT} style={WIDGET_HINT_STYLE}>
              {prettySkDate(last.date)}
              {title ? ` · ${title}` : ""}
            </div>
            <div className={WIDGET_KV_GRID}>
              {distanceStr && (
                <>
                  <div className={WIDGET_KV_LABEL}>
                    {t("sessions.card.distance" as any) || "Vzdialenosť"}
                  </div>
                  <div className={WIDGET_KV_VALUE}>{distanceStr}</div>
                </>
              )}
              {timeStr && (
                <>
                  <div className={WIDGET_KV_LABEL}>
                    {t("sessions.card.time" as any) || "Čas"}
                  </div>
                  <div className={WIDGET_KV_VALUE}>{timeStr}</div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </button>
  );
}
