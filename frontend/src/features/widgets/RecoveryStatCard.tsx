// src/features/widgets/RecoveryStatCard.tsx
"use client";
"use client";

type Props = {
  title: string;
  value: string;
  unit?: string;
  note?: string;
  /** Tailwind bg-* class for the accent bar */
  accent?: string;
  /** If provided, a small button appears in the top-right corner */
  onOpenDetail?: () => void;
  /** Text on that button (default: "Detail") */
  buttonText?: string;
};

export default function RecoveryStatCard({
  title,
  value,
  unit,
  note,
  accent = "bg-slate-700",
  onOpenDetail,
  buttonText = "Detail",
}: Props) {
  return (
    <div className="relative bg-white dark:bg-gray-800 p-4 rounded shadow">
      {onOpenDetail && (
        <button
          onClick={onOpenDetail}
          className="absolute right-3 top-3 text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600"
        >
          {buttonText}
        </button>
      )}

      <div className="text-sm opacity-80 mb-2">{title}</div>

      <div className="flex items-baseline gap-2 mb-2">
        <div className="text-4xl font-bold">{value}</div>
        {unit && <div className="text-lg opacity-80">{unit}</div>}
      </div>

      {note && <div className="text-sm opacity-90">{note}</div>}

      <div className={`mt-3 h-1.5 w-16 rounded ${accent}`} />
    </div>
  );
}