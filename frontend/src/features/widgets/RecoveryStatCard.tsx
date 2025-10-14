// src/features/widgets/RecoveryStatCard.tsx
"use client";

export default function RecoveryStatCard({
  title,
  value,
  unit,
  note,
  accent = "bg-slate-700",
  onOpenDetail,
}: {
  title: string;
  value: string;
  unit?: string;
  note?: string;
  accent?: string;        // Tailwind trieda pre farbu odznaku
  onOpenDetail?: () => void;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded shadow">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm opacity-70">{title}</div>
          <div className="mt-1 flex items-baseline gap-2">
            <div className="text-2xl font-semibold">{value}</div>
            {unit && <div className="text-sm opacity-70">{unit}</div>}
          </div>
          {note && <div className="mt-2 text-sm opacity-90">{note}</div>}
        </div>

        <div className={`px-2 py-1 rounded text-xs text-white ${accent}`}>
          Widget
        </div>
      </div>

      {onOpenDetail && (
        <div className="mt-3">
          <button
            onClick={onOpenDetail}
            className="text-xs px-2 py-1 rounded bg-gray-700 text-white"
          >
            Detail
          </button>
        </div>
      )}
    </div>
  );
}
