"use client";
import React from "react";

type Props = {
  title: string;
  note?: string;
  accent?: string;
  onOpenDetail?: () => void;   // ak je, celá karta je klikateľná
  children?: React.ReactNode;  // sem idú grafy/obsah
};

export default function OpenerWidget({
  title,
  note,
  accent = "bg-slate-700",
  onOpenDetail,
  children,
}: Props) {
  const Wrapper: React.ElementType = onOpenDetail ? "button" : "div";

  return (
    <Wrapper
      onClick={onOpenDetail}
      className={`w-full text-left bg-white dark:bg-gray-800 rounded shadow px-4 py-4 focus:outline-none ${
        onOpenDetail ? "hover:bg-gray-700/40 transition-colors cursor-pointer" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="text-base sm:text-lg font-semibold">{title}</h3>
        {onOpenDetail && (
          <span className="text-xs opacity-75">otvoriť detail ⟶</span>
        )}
      </div>

      {note && <p className="opacity-80 mb-2">{note}</p>}

      {/* obsah (graf) */}
      <div>{children}</div>

      <div className={`h-2 rounded mt-3 ${accent}`} />
    </Wrapper>
  );
}