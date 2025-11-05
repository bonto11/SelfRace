"use client";

import { useMemo } from "react";
import CommonActivityCard from "@/shared/components/CommonActivityCard";
import ActivityDetail from "@/shared/components/ActivityDetail";

/** ===== Typy dát pre jednotlivé varianty ===== */
type Variant = "activity" | "calendar" | "record" | "plan";

// record (PB)
type RecordData = {
  id: string | number;
  distanceLabel: string;      // "5 km"
  timeStr: string;            // "00:18:45"
  dateIso?: string | null;
  activityId?: number | null;
  activityName?: string | null;
  isFavorite?: boolean;
};

// activity / calendar
type ActivityData = {
  id: string | number;
  name: string;
  dateIso: string;
  sport: "run" | "ride" | "strength" | "mixed" | "other" | string;
  timeStr?: string | null;
  distanceStr?: string | null;
  avgHr?: number | null;
  maxHr?: number | null;
  activityId: number;              // na načítanie detailu
  singleDayContext?: boolean;      // pod kalendárom: 1 deň => skryť mini header
};

// plan (AI coach)
type PlanData = {
  id: string;
  dateLabel?: string | null;       // "Mon · 2025-11-03"
  title: string;
  focus?: string | null;
  durationMin?: number | null;
  intensity?: string | null;
  target?: string | null;
  structure?: any;                 // pre <PlanCardDetail />
};

type DataByVariant<V extends Variant> =
  V extends "record"   ? RecordData   :
  V extends "plan"     ? PlanData     :
  V extends "calendar" ? ActivityData :
  /* "activity" */       ActivityData;

type Props<V extends Variant = Variant> = {
  variant: V;
  data: DataByVariant<V>;
};

/** ===== Pomocné formátovanie ===== */
const prettySkDate = (iso?: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  const day = d.toLocaleDateString("sk-SK", { day: "2-digit", month: "2-digit", year: "numeric" });
  const wk = d.toLocaleDateString("sk-SK", { weekday: "short" });
  return `${wk} · ${day}`;
};

/** ===== Hlavný komponent ===== */
export default function ActivitySingle<V extends Variant>({ variant, data }: Props<V>) {
  // rozhodnutie o flush detaile (zarovnanie k okrajom karty)
  const flushDetail = variant === "activity" || variant === "calendar" || variant === "plan";

  if (variant === "record") {
    const d = data as RecordData;
    const headerLeft = d.dateIso ? prettySkDate(d.dateIso) : "—";
    const subtitle = d.activityName || null;

    return (
      <CommonActivityCard
        id={`rec-${d.id}`}
        headerLeft={headerLeft ?? "—"}
        sportKind="other"
        title={d.timeStr}
        subtitle={subtitle}
        meta={d.distanceLabel ? [d.distanceLabel] : undefined}
        defaultOpen={false}
        hideSubtitleWhenOpen
        hideMetaWhenOpen
        flushDetail={flushDetail}
        /* swipe riešime neskôr cez obal (PB zoznam má vlastný SwipeRow) */
      >
        {/* defaultne PB detail nenechávame – vieme pridať neskôr */}
        {/* napr. ak by si chcel, vložíš <ActivityDetail activityId={...} inline compact showHeader={false} /> */}
      </CommonActivityCard>
    );
  }

  if (variant === "plan") {
    const d = data as PlanData;

    const meta: string[] = [];
    if (d.durationMin != null) meta.push(`${d.durationMin} min`);
    if (d.intensity) meta.push(d.intensity);
    if (d.target) meta.push(d.target);

    return (
      <CommonActivityCard
        id={`plan-${d.id}`}
        headerLeft={d.dateLabel ?? "—"}
        sportKind="other"
        title={d.title}
        subtitle={d.focus || null}
        meta={meta}
        defaultOpen={false}
        hideSubtitleWhenOpen
        hideMetaWhenOpen
        flushDetail={flushDetail}
        disableToggleIfNoChildren={!d.structure}
      >
        {d.structure ? (
          // tvoje existujúce renderovanie štruktúry:
          // zámerne tu nenechávam SUBCARD – flush + vnútorný padding rieši CommonActivityCard
          <div className="px-2 pb-2">
            {/* Adapter: nechaj si tu pôvodný <PlanCardDetail s={d.structure} /> keď ho budeš migrovať */}
            {/* Dočasný fallback: */}
            <pre className="text-xs opacity-80 whitespace-pre-wrap">
              {JSON.stringify(d.structure, null, 2)}
            </pre>
          </div>
        ) : null}
      </CommonActivityCard>
    );
  }

  // activity & calendar (takmer rovnaké)
  if (variant === "activity" || variant === "calendar") {
    const d = data as ActivityData;

    const headerLeft =
      d.singleDayContext && variant === "calendar"
        ? " "
        : prettySkDate(d.dateIso) ?? "—";

    // meta riadok (Time · Distance · Avg/Max HR)
    const meta = useMemo(() => {
      const xs: (string | null)[] = [];
      if (d.timeStr) xs.push(`Time ${d.timeStr}`);
      if (d.distanceStr) xs.push(`Distance ${d.distanceStr}`);
      if (d.avgHr != null) xs.push(`Avg HR ${d.avgHr}`);
      if (d.maxHr != null) xs.push(`Max HR ${d.maxHr}`);
      return xs.filter(Boolean) as string[];
    }, [d.timeStr, d.distanceStr, d.avgHr, d.maxHr]);

    // pod kalendárom používame kompaktnejší detail a bez headera/KPI duplikátov
    const compactDetail = true;
    const showHeader = false;
    const showKpis = false;

    return (
      <CommonActivityCard
        id={`act-${d.id}`}
        headerLeft={headerLeft}
        sportKind={d.sport}
        title={d.name || "Activity"}
        subtitle={null}
        meta={meta}
        defaultOpen={false}
        hideSubtitleWhenOpen
        hideMetaWhenOpen
        flushDetail={flushDetail}
      >
        <div className="px-2 pb-2">
          <ActivityDetail
            activityId={d.activityId}
            inline
            compact={compactDetail}
            showHeader={showHeader}
            showKpis={showKpis}
            padInner={false}
          />
        </div>
      </CommonActivityCard>
    );
  }

  // never
  return null;
}