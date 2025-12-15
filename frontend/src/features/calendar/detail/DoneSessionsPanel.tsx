"use client";

import * as React from "react";
import Button from "@/shared/components/ui/Button";
import PlanSingle from "@/shared/components/PlanSingle";
import type { PlanStatus } from "@/shared/components/PlanSingle";

import { detectSport } from "@/features/coach/utils/plan";
import { findTrainingTypeById } from "@/shared/types/training";
import { normDuration, normIntensity, normNotes, normTarget, normTitle, fmtRealDurationMin } from "@/features/calendar/utils/calendarFormat";

type AnyObj = Record<string, any>;

type Props = {
  selectedLabel: string;
  donePlans: any[];
  actMap: Map<number, any>;
  onOpenActivity: (activityId: number) => void;
};

export default function DoneSessionsPanel({ selectedLabel, donePlans, actMap, onOpenActivity }: Props) {
  if (!donePlans.length) return null;

  return (
    <>
      <div className="text-[11px] uppercase tracking-wide opacity-70 mb-1 mt-1.5">
        Splnené tréningy — {selectedLabel}
      </div>

      <ul className="space-y-2">
        {donePlans.map((p: any) => {
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

          const actId = p.activity_id != null ? Number(p.activity_id) : null;
          const act = actId != null && !Number.isNaN(actId) ? actMap.get(actId) : null;

          const actDur = fmtRealDurationMin(act?.moving_time_s ?? act?.moving_time);
          const distStr = act?.distance_m != null ? `${(act.distance_m / 1000).toFixed(2)} km` : null;

          const activitySummary =
            actId != null && !Number.isNaN(actId)
              ? [act?.name || "Activity", distStr, actDur].filter(Boolean).join(" · ")
              : null;

          const handleOpen = () => {
            if (actId != null && !Number.isNaN(actId)) onOpenActivity(actId);
          };

          return (
            <li key={`done-${p.id}`} className="px-0">
              <PlanSingle
                id={p.id}
                title={title}
                dateIso={String(p.plan_date).slice(0, 10)}
                sport={sport}
                status={"done" as PlanStatus}
                planDur={normDuration(sess)}
                planIntensity={normIntensity(sess)}
                planTarget={normTarget(sess)}
                planNotes={combinedNotes || null}
                activitySummary={activitySummary}
              >
                <div className="text-xs flex flex-row gap-2 items-center">
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={handleOpen}
                    disabled={actId == null || Number.isNaN(actId)}
                  >
                    Otvoriť aktivitu
                  </Button>
                </div>
              </PlanSingle>
            </li>
          );
        })}
      </ul>
    </>
  );
}