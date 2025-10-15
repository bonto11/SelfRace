// src/features/recovery/components/RecoveryStatCard.tsx
"use client";
import React from "react";

type Props = {
  title: string;
  value: string;
  unit?: string;
  note?: string;
  accent?: string;             // farba malej lišty dole (Tailwind trieda)
  onOpenDetail?: () => void;   // ak je, celý panel je klikateľný
};

export default function RecoveryStatCard({
  title,
  value,
  unit,
  note,
  accent = "bg-slate-700",
  onOpenDetail,
}: Props) {
  const Wrapper: React.ElementType = onOpenDetail ? "button" : "div";

  return (
    <Wrapper
      onClick={onOpenDetail}
      className={`w-full text-left bg-white dark:bg-gray-800 rounded shadow px-4 py-4 focus:outline-none ${
        onOpenDetail ? "hover:bg-gray-700/40 transition-colors cursor-pointer" : ""
      }`}
    >
      <h3 className="text-lg font-semibold mb-2">{title}</h3>

      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-5xl font-extrabold leading-none">{value}</span>
        {unit && <span className="text-xl opacity-80">{unit}</span>}
      </div>

      {note && <p className="opacity-80 mb-3">{note}</p>}

      <div className={`h-2 rounded ${accent}`} />
    </Wrapper>
  );
}
