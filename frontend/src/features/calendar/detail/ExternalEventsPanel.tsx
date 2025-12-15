"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Button from "@/shared/components/ui/Button";
import { CARD } from "@/shared/ui/classes";

type Row = {
  id: number | string;
  sport: string;
  title: string;
  time?: string | null;
  notes?: string | null;
};

type Props = {
  selectedIso: string;
  selectedLabel: string;
  rows: Row[];
  sportColors: Record<string, string>;
};

export default function ExternalEventsPanel({ selectedIso, selectedLabel, rows, sportColors }: Props) {
  const router = useRouter();

  const handleGoExternal = React.useCallback(() => {
    router.push(`/coach/external?date=${encodeURIComponent(selectedIso)}`);
  }, [router, selectedIso]);

  return (
    <div className={[CARD, "space-y-2", "p-3 md:p-4"].join(" ")}>
      <div className="flex items-center justify-between mb-1.5">
        <h3 className="text-sm font-semibold">Externé eventy — {selectedLabel}</h3>

        {/* kruhová šípka */}
        <Button
          variant="ghost"
          size="sm"
          circle
          aria-label="Otvoriť externé eventy"
          onClick={handleGoExternal}
          title="Otvoriť externé eventy"
        >
          ↻
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm opacity-70">Pre tento deň nemáš žiadne externé eventy.</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((ev, idx) => {
            const color = sportColors[ev.sport] ?? sportColors.other;
            return (
              <li key={`${ev.id ?? idx}`} className="text-sm flex items-start gap-2">
                <span
                  className="inline-block w-2 h-2 rounded-full translate-y-[6px]"
                  style={{ backgroundColor: color }}
                  aria-hidden
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {ev.time && <span className="text-[11px] opacity-70 tabular-nums">{ev.time}</span>}
                    <span className="font-medium">{ev.title}</span>
                  </div>
                  {ev.notes && <div className="text-[12px] opacity-75 mt-0.5">{ev.notes}</div>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}