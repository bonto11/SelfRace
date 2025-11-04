// src/features/coach/components/CoachViewPanel.tsx
"use client";

type Props = {
  narrative?: {
    period_summary?: string | null;
    last_week_summary?: string | null;
  } | null;
};

export default function CoachViewPanel({ narrative }: Props) {
  if (!narrative || (!narrative.period_summary && !narrative.last_week_summary)) {
    return null;
  }

  return (
    <section className="rounded-xl border border-white/10 p-3 bg-white/70 dark:bg-gray-900/40">
      <h3 className="font-semibold mb-2">Coach view</h3>

      {narrative.period_summary && (
        <p className="text-sm mb-1">
          <b>Posledné obdobie:</b> {narrative.period_summary}
        </p>
      )}

      {narrative.last_week_summary && (
        <p className="text-sm">
          <b>Minulý týždeň:</b> {narrative.last_week_summary}
        </p>
      )}
    </section>
  );
}