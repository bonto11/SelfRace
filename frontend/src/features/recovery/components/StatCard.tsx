// src/features/recovery/components/StatCard.tsx
"use client";

import React from "react";

type Props = {
  title: string;
  value: string;
  unit?: string;
  note?: string;
  accent?: string; // tailwind bg-*
  onOpenDetail?: () => void;
};

export default function RecoveryStatCard({
  title,
  value,
  unit,
  note,
  accent = "bg-slate-700",
  onOpenDetail,
}: Props) {
  const clickable = !!onOpenDetail;

  const handleKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!clickable) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpenDetail?.();
    }
  };

  return (
    <div
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={onOpenDetail}
      onKeyDown={handleKey}
      className={[
        "bg-white dark:bg-gray-800 rounded shadow p-4 select-none",
        clickable ? "cursor-pointer ring-0 hover:ring-1 hover:ring-sky-500 transition" : "",
      ].join(" ")}
    >
      <h3 className="text-base font-semibold mb-2">{title}</h3>

      <div className="flex items-baseline gap-2">
        <div className="text-4xl font-bold">{value}</div>
        {unit ? <div className="uppercase opacity-70">{unit}</div> : null}
      </div>

      {note ? <p className="mt-3 opacity-90">{note}</p> : null}

      <div className="mt-4 h-2 w-28 rounded-full"
           style={{ backgroundColor: "transparent" }}>
        <div className={`h-2 rounded-full ${accent}`} />
      </div>
    </div>
  );
}
