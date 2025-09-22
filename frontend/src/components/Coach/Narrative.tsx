"use client";

export default function Narrative({ narrative }: { narrative: any }) {
  if (!narrative) return null;
  const { period_summary, last_week_summary } = narrative;
  if (!period_summary && !last_week_summary) return null;

  return (
    <div className="mt-4 bg-gray-900/40 border border-gray-700 rounded p-3">
      <h3 className="font-semibold mb-1">Coach view</h3>
      {period_summary && (
        <p className="mb-1">
          <b>Posledné obdobie:</b> {period_summary}
        </p>
      )}
      {last_week_summary && (
        <p className="mb-1">
          <b>Minulý týždeň:</b> {last_week_summary}
        </p>
      )}
    </div>
  );
}
