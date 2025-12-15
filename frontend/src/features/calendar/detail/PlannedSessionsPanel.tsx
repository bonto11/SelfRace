"use client";

import * as React from "react";
import PlanSingle, { type PlanStatus } from "@/shared/components/PlanSingle";
import Button from "@/shared/components/ui/Button";
import { CARD } from "@/shared/ui/classes";
import type { UnifiedSessionItem } from "@/features/calendar/detail/PastSessionsPanel";

type Props = {
  selectedIso: string;
  selectedLabel: string;
  rows: UnifiedSessionItem[];
  sportColors: Record<string, string>;
  todayIso: string;
};

function headerLabel(selectedIso: string, todayIso: string) {
  if (selectedIso > todayIso) return "Planned";
  if (selectedIso === todayIso) return "Planned (today)";
  return "Planned (none)";
}

export default function PlannedSessionsPanel({
  selectedIso,
  selectedLabel,
  rows,
  todayIso,
}: Props) {
  const label = headerLabel(selectedIso, todayIso);

  return (
    <div className={[CARD, "space-y-2", "p-3 md:p-4"].join(" ")}>
      <div className="flex items-center justify-between mb-1.5">
        <h4 className="text-sm font-semibold">
          {label} — {selectedLabel}
        </h4>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm opacity-70">
          Žiadne plánované položky pre tento deň.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((it) => {
            const rightLine =
              it.kind === "external" ? it.time ?? null : null;

            const notesLine =
              it.notes && String(it.notes).trim() ? String(it.notes) : null;

            // planned items sú vždy planned (alebo done pri externale v minulosti – sem sa nedostane)
            const status: PlanStatus = it.status;

            return (
              <li key={it.key} className="px-0">
                <PlanSingle
                  id={it.id}
                  title={it.title}
                  dateIso={it.dateIso}
                  sport={it.sport}
                  status={status}
                  planDur={null}
                  planIntensity={rightLine}
                  planTarget={null}
                  planNotes={notesLine}
                  activitySummary={null}
                >
                  {it.onOpen ? (
                    <div className="text-xs flex flex-row gap-2 items-center">
                      <Button variant="ghost" size="xs" onClick={it.onOpen}>
                        Detail
                      </Button>
                    </div>
                  ) : null}
                </PlanSingle>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}