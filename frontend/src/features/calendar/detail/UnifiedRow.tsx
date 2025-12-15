"use client";

import * as React from "react";
import PlanSingle from "@/shared/components/PlanSingle";
import type { PlanStatus } from "@/shared/components/PlanSingle";

export type UnifiedItem = {
  id: string;
  kind: "activity" | "plan" | "external";
  sport: string;
  dateIso: string;
  title: string;
  status?: PlanStatus;
  meta?: {
    distanceKm?: number;
    durationMin?: number;
    notes?: string;
  };
};

export default function UnifiedRow({ item }: { item: UnifiedItem }) {
  const activitySummary =
    item.kind === "activity"
      ? [
          item.meta?.distanceKm != null
            ? `${item.meta.distanceKm.toFixed(2)} km`
            : null,
          item.meta?.durationMin != null
            ? `${item.meta.durationMin} min`
            : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : null;

  return (
    <PlanSingle
      id={item.id}
      title={item.title}
      dateIso={item.dateIso}
      sport={item.sport}
      status={item.status}
      planNotes={item.meta?.notes ?? null}
      activitySummary={activitySummary}
    />
  );
}