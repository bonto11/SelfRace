// src/app/(protected)/activities/todayActivities/[activityId]/page.tsx
"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import PageShell from "@/app/shared/ui/components/PageShell";
import { PANEL_PREVIEW } from "@/app/shared/ui/tokens";
import { useActivityData } from "@/app/shared/components/dataProviders/ActivityDataProvider";
import SessionCard, { type SessionItem } from "@/app/shared/components/session/SessionCard";
import { useT } from "@/app/shared/i18n/useT";

function fmtMinutes(min: number | null | undefined, t: any): string | null {
  if (typeof min !== "number" || !Number.isFinite(min) || min <= 0) return null;
  return `${Math.round(min)} ${t("common.units.min")}`;
}

function fmtDistanceKm(m: number | null | undefined, t: any): string | null {
  if (typeof m !== "number" || !Number.isFinite(m) || m <= 0) return null;
  return `${(m / 1000).toFixed(2)} ${t("common.units.km")}`;
}

/**
 * Detail JEDNEJ aktivity podľa ID — z WidgetTodayActivities aj z push
 * notifikácie.
 *
 * 🔍 PREDPOKLAD (over si, ak sa detail nezobrazí úplne): SessionCard
 * (presnejšie DetailSession vo vnútri, ktorý som nevidel) si laps/splits/
 * streams/enrichment ťahá SÁM cez ActivityDataProvider.getExtras()/
 * getEnrichment(), keď sa karta otvorí — presne tak, ako to už funguje
 * v calendari pre bežnú aktivitu bez plánu (item.kind="session",
 * activityId vyplnené, planId=null). Preto sem neposielam
 * bundle.enrichment/streams/laps/splits vôbec — len postavím SessionItem
 * zo summary. Ak by DetailSession čakal tieto dáta ako props, pošli mi
 * DetailSession.tsx a doladím to.
 *
 * Zámerne NEPOUŽÍVAM buildDayBuckets/DayDetail (kalendárové) — tie riešia
 * párovanie plán+aktivita pre CELÝ DEŇ naraz, čo tu nepotrebujeme.
 *
 * ⚠️ getSummary číta zo 90-dňového rozsahu už načítaného v provideri.
 * Pre aktivity z "dnes" (WidgetTodayActivities, čerstvo synchronizovaná
 * notifikácia) je to vždy v poriadku — pre výrazne staršie ID by summary
 * mohlo vyjsť null, kým sa provider nerefreshne so širším rozsahom.
 */
export default function ActivityDetailPage() {
  const params = useParams();
  const t = useT();
  const activityId = params?.activityId ? Number(params.activityId) : null;

  const { getSummary } = useActivityData();
  const summary = activityId != null ? getSummary(activityId) : null;

  const item: SessionItem | null = useMemo(() => {
    if (!summary || activityId == null) return null;

    const dist = fmtDistanceKm(summary.distance_m, t);
    const dur = fmtMinutes((summary.moving_time_s ?? 0) / 60, t);
    const sport =
      summary.sport_type_ovrd ?? summary.sport_type_fe ?? summary.sport_type ?? "other";

    const kpis = [
      dur ? { label: t("common.metrics.time"), value: dur } : null,
      dist ? { label: t("common.metrics.distance"), value: dist } : null,
      summary.average_heartrate_bpm != null
        ? { label: t("common.metrics.hr_avg"), value: String(Math.round(summary.average_heartrate_bpm)) }
        : null,
      summary.max_heartrate_bpm != null
        ? { label: t("common.metrics.hr_max"), value: String(Math.round(summary.max_heartrate_bpm)) }
        : null,
    ].filter(Boolean) as { label: string; value: any }[];

    return {
      kind: "session",
      id: `s:a:${activityId}`,
      dateIso: summary.date,
      sport: String(sport),
      title: summary.name || t("activities.title"),
      subtitle: dist
        ? `${t("common.metrics.distance")} ${dist}`
        : dur
          ? `${t("common.metrics.time")} ${dur}`
          : null,
      kpis,
      notes: summary.description || summary.comment || null,

      planId: null,
      activityId,

      timeStr: dur,
      distanceStr: dist,
      avgHr: summary.average_heartrate_bpm ?? null,
      maxHr: summary.max_heartrate_bpm ?? null,

      defaultOpen: true,
    };
  }, [summary, activityId, t]);

  return (
    <PageShell title={t("activities.title")} showBack showPoweredByStrava={false}>
      {!activityId ? (
        <div className={PANEL_PREVIEW}>Chýba ID aktivity.</div>
      ) : !item ? (
        <div className={PANEL_PREVIEW}>
          Aktivita sa nenašla (ID: {activityId}). Skús obnoviť Aktivity stránku.
        </div>
      ) : (
        <SessionCard variant="activity" item={item} />
      )}
    </PageShell>
  );
}
