"use client";

import * as React from "react";
import PlanSingle, { type PlanStatus } from "@/shared/components/PlanSingle";
import Button from "@/shared/components/ui/Button";
import { CARD } from "@/shared/ui/classes";

export type UnifiedSessionItem = {
  key: string;
  kind: "activity" | "plan" | "external";
  id: number;
  sport: string;
  dateIso: string;
  status: PlanStatus;
  title: string;
  time?: string | null;
  notes?: string | null;

  // iba pre activity / fallback
  activityId?: number | null;
  activitySummary?: string | null;

  onOpen?: (() => void) | null;
};

type Props = {
  selectedIso: string;
  selectedLabel: string;
  rows: UnifiedSessionItem[];
  sportColors: Record<string, string>;
  todayIso: string;
};

function headerLabel(selectedIso: string, todayIso: string) {
  if (selectedIso < todayIso) return "Past";
  if (selectedIso === todayIso) return "Done / Past (today)";
  return "Past (none)";
}

export default function PastSessionsPanel({
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
          Žiadne aktivity ani “missed” položky pre tento deň.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((it) => {
            const rightLine =
              it.kind === "activity"
                ? it.activitySummary ?? null
                : it.kind === "external"
                ? it.time ?? null
                : null;

            const notesLine =
              it.notes && String(it.notes).trim() ? String(it.notes) : null;

            return (
              <li key={it.key} className="px-0">
                <PlanSingle
                  id={it.id}
                  title={it.title}
                  dateIso={it.dateIso}
                  sport={it.sport}
                  status={it.status}
                  planDur={null}
                  planIntensity={rightLine}
                  planTarget={null}
                  planNotes={notesLine}
                  activitySummary={it.kind === "activity" ? it.activitySummary ?? null : null}
                >
                  {it.onOpen ? (
                    <div className="text-xs flex flex-row gap-2 items-center">
                      <Button variant="ghost" size="xs" onClick={it.onOpen}>
                        {it.kind === "activity"
                          ? "Otvoriť aktivitu"
                          : it.kind === "external"
                          ? "Detail"
                          : "Detail"}
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