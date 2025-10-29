//src/features/widgets/OpenerWidget.tsx
"use client";
import React from "react";

type Props = {
  title: string;
  note?: string;
  accent?: string; // farba lišty dole (Tailwind)
  onOpenDetail?: () => void; // ak je, celá karta je klikateľná
  children?: React.ReactNode; // vnútorný obsah (čísla/graf)
  className?: string;
};

export default function OpenerWidget({
  title,
  note,
  accent = "bg-slate-700",
  onOpenDetail,
  children,
  className = "",
}: Props) {
  const Wrapper: React.ElementType = onOpenDetail ? "button" : "div";

  return (
    <Wrapper
      onClick={onOpenDetail}
      className={[
        "w-full text-left bg-white dark:bg-gray-800 rounded shadow p-4",
        "focus:outline-none",
        onOpenDetail
          ? "hover:bg-gray-700/40 transition-colors cursor-pointer"
          : "",
        // konzistentná výška a rozloženie
        "flex flex-col min-h-[160px]",
        className,
      ].join(" ")}
    >
      {/* header */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="text-sm md:text-base font-semibold tracking-tight">
          {title}
        </h3>
        {onOpenDetail && (
          <span className="text-xs opacity-75 whitespace-nowrap">
            otvoriť detail ⟶
          </span>
        )}
      </div>

      {/* obsah */}
      <div className="flex-1">
        {children}
        {note && <p className="opacity-80 text-sm mt-2">{note}</p>}
      </div>

      {/* spodná lišta */}
      <div className={`h-1.5 rounded mt-3 ${accent}`} />
    </Wrapper>
  );
}
