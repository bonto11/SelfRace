"use client";

import * as React from "react";
import PlanSingle, { PlanStatus } from "@/shared/components/PlanSingle";
import { detectSport } from "@/features/coach/utils/plan";
import { findTrainingTypeById } from "@/shared/types/training";
import { normDuration, normIntensity, normNotes, normTarget, normTitle } from "@/features/calendar/utils/calendarFormat";

type AnyObj = Record<string, any>;

type Props = {
  todayIso: string;
  plannedRows: any[];
};

export default function PlannedSessionsPanel({ todayIso, plannedRows }: Props) {
  if (!plannedRows.length) return null;

  return (
    <>
      <div className="text-[11px] uppercase tracking-wide opacity-70 mb-1 mt-2">
        Plánované tréningy
      </div>

      <ul className="space-y-2">
        {plannedRows.map((p: any) => {
          const sess: AnyObj = p.payload ?? p;
          const sport = (p as any).sport || detectSport(sess) || "other";

          const sessionTypeId =
            typeof sess?.session_type === "string"
              ? sess.session_type
              : typeof p.session_type === "string"
              ? p.session_type
              : null;

          const trainingDef = sessionTypeId ? findTrainingTypeById(sessionTypeId) : null;
          const title = trainingDef?.label || normTitle(sess) || "Tréning";

          const baseNotes = normNotes(sess);
          const typeLine = trainingDef?.description || null;
          const combinedNotes = [typeLine, baseNotes].filter(Boolean).join(" • ");

          const dIso = String(p.plan_date).slice(0, 10);
          const status: PlanStatus = dIso < todayIso ? "missed" : "planned";

          return (
            <li key={p.id} className="px-0">
              <PlanSingle
                id={p.id}
                title={title}
                dateIso={dIso}
                sport={sport}
                status={status}
                planDur={normDuration(sess)}
                planIntensity={normIntensity(sess)}
                planTarget={normTarget(sess)}
                planNotes={combinedNotes || null}
                activitySummary={null}
              />
            </li>
          );
        })}
      </ul>
    </>
  );
}