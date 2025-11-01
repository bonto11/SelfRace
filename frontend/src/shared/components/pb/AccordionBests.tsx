"use client";
import { useState } from "react";

export default function AccordionBests() {
  const [openRun, setOpenRun] = useState(true);

  return (
    <div className="space-y-3">
      {/* RUN */}
      <section
        className={[
          "rounded-2xl shadow-lg border border-white/10",
          "bg-white/90 dark:bg-gray-900/70 backdrop-blur"
        ].join(" ")}
      >
        <header
          onClick={() => setOpenRun(v => !v)}
          className="px-4 py-3 cursor-pointer flex items-center justify-between select-none"
        >
          <h3 className="text-base font-semibold tracking-tight">Personal Bests — Running</h3>
          <span className="text-sm opacity-75">{openRun ? "▾" : "▸"}</span>
        </header>

        {openRun && (
          <div className="px-4 pb-4">
            {/* lazy import tu nechávam na teba, teraz priamo */}
            {/* @ts-expect-error TS nedokáže staticky zdetegovať separátny súbor v ukážke */}
            <PBRun />
          </div>
        )}

        {/* spodná lišta - neutrál */}
        <div className="h-1.5 rounded-b-2xl bg-slate-700" />
      </section>

      {/* placeholdery (rovnaký look, disabled) */}
      {[
        "Personal Bests — Cycling",
        "Personal Bests — Strength",
        "Personal Bests — Swimming",
      ].map((title) => (
        <section
          key={title}
          className="rounded-2xl shadow-lg border border-white/10 bg-white/70 dark:bg-gray-900/50 backdrop-blur"
        >
          <header className="px-4 py-3 flex items-center justify-between opacity-70">
            <h3 className="text-base font-semibold tracking-tight">{title}</h3>
            <span>soon</span>
          </header>
          <div className="h-1.5 rounded-b-2xl bg-slate-700/60" />
        </section>
      ))}
    </div>
  );
}