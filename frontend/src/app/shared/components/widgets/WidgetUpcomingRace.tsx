// src/app/shared/components/widgets/WidgetUpcomingRace.tsx
"use client";

import { useEffect, useState } from "react";
import WidgetCard from "@/app/shared/ui/components/WidgetCard";
import LoadingSpinner from "@/app/shared/ui/components/LoadingSpinner";
import { useUserId } from "@/app/shared/hooks/useUserId";
import { apiFetchUserPref } from "@/app/features/prefs/api/prefs";
import { appColors } from "@/app/shared/ui/theme/app_colors";
import {
  WIDGET_LOADING_WRAP, WIDGET_VALUE_ROW,
  WIDGET_VALUE_PRIMARY, WIDGET_VALUE_UNIT, WIDGET_NOTE,
} from "@/app/shared/ui/tokens";
import { useT } from "@/app/shared/i18n/useT";

/* ─── HELPER: dni do závodu ─── */
function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const race = new Date(dateStr);
  race.setHours(0, 0, 0, 0);
  return Math.round((race.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr: string, locale: string): string {
  try {
    return new Date(dateStr).toLocaleDateString(locale, {
      day: "numeric", month: "short", year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

/* ─── WIDGET ─── */
export default function WidgetUpcomingRace({ onOpenDetail }: { onOpenDetail?: () => void }) {
  const { userId } = useUserId();
  const t = useT();
  const [loading, setLoading] = useState(true);
  const [race, setRace] = useState<any>(null);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      try {
        const prefs = await apiFetchUserPref(userId, "coach.prefs");
        if (!alive) return;
        const races: any[] = prefs?.targets?.run?.races ?? [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        // Zoraď podľa dátumu, over že je v budúcnosti, preferuj A prioritu
        const upcoming = races
          .filter((r) => r.date && new Date(r.date) >= today)
          .sort((a, b) => {
            // A priority first, then by date
            if (a.priority === "A" && b.priority !== "A") return -1;
            if (b.priority === "A" && a.priority !== "A") return 1;
            return new Date(a.date).getTime() - new Date(b.date).getTime();
          });
        setRace(upcoming[0] ?? null);
      } catch (e) {
        console.error("[WidgetUpcomingRace]", e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [userId]);

  const days = race?.date ? daysUntil(race.date) : null;

  // Farba podľa blízkosti závodu
  const countdownColor = days === null ? appColors.textMuted
    : days <= 7  ? appColors.stateDanger
    : days <= 21 ? appColors.stateWarning
    : "#4ade80";

  const cardAccent = days !== null && days <= 7
    ? appColors.stateDanger
    : days !== null && days <= 21
    ? appColors.stateWarning
    : "none";

  const locale = (t as any)("common.locale") || "sk-SK";

  return (
    <WidgetCard
      title={t("upcomingRace.widget.title") as any || "Nadchádzajúci závod"}
      tooltip={t("upcomingRace.widget.tooltip") as any || "Najbližší plánovaný závod"}
      accent={cardAccent}
      onOpen={onOpenDetail}
      interactive={!!onOpenDetail}
      minH={160}
    >
      {loading ? (
        <div className={WIDGET_LOADING_WRAP}><LoadingSpinner size="widget" /></div>
      ) : !race ? (
        <p className={WIDGET_NOTE} style={{ color: appColors.textMuted }}>
          {t("upcomingRace.widget.noRace") as any || "Žiadny závod nie je nastavený"}
        </p>
      ) : (
        <>
          {/* Odpočet */}
          <div className={WIDGET_VALUE_ROW} style={{ alignItems: "baseline", gap: 4 }}>
            <span className={WIDGET_VALUE_PRIMARY} style={{ color: countdownColor }}>
              {days}
            </span>
            <span className={WIDGET_VALUE_UNIT} style={{ color: countdownColor }}>
              {t("common.units.days") as any || "dní"}
            </span>
            {race.priority && (
              <span style={{
                marginLeft: 6, fontSize: 10, fontWeight: 700,
                color: race.priority === "A" ? "#facc15" : appColors.textMuted,
                border: `1px solid ${race.priority === "A" ? "#facc15" : appColors.panelBorder}`,
                borderRadius: 4, padding: "1px 5px", lineHeight: 1.4,
              }}>
                {race.priority}
              </span>
            )}
          </div>

          {/* Názov závodu */}
          {race.name && (
            <p style={{
              fontSize: 13, fontWeight: 600, color: appColors.textPrimary,
              marginTop: 4, marginBottom: 2,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {race.name}
            </p>
          )}

          {/* Dátum */}
          <p className={WIDGET_NOTE}>
            {formatDate(race.date, locale)}
            {race.race_goal && ` · ${race.race_goal.toUpperCase()}`}
          </p>
        </>
      )}
    </WidgetCard>
  );
}
