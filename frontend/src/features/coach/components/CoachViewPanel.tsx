// src/features/coach/components/CoachViewPanel.tsx
"use client";

import { CARD } from "@/shared/ui/classes";

export default function CoachViewPanel({
  narrative,
}: {
  narrative?: {
    period_summary?: string | null;
    last_week_summary?: string | null;
  } | null;
}) {
  if (!narrative || (!narrative.period_summary && !narrative.last_week_summary)) return null;

  return (
    <div className={`${CARD} space-y-2`}>
      <h3 className="text-base font-semibold">Coach view</h3>
      {narrative.period_summary && (
        <p className="text-sm">
          <b>Posledné obdobie:</b> {narrative.period_summary}
        </p>
      )}
      {narrative.last_week_summary && (
        <p className="text-sm">
          <b>Minulý týždeň:</b> {narrative.last_week_summary}
        </p>
      )}
    </div>
  );
}