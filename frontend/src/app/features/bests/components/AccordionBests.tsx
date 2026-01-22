"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { SURFACE_CARD, SURFACE_SUBCARD } from "@/app/shared/ui/tokens";

// lazy import – nech sa PBRun nenačítava zbytočne
const PBRun = dynamic(() => import("@/app/features/bests/components/PBRun"), {
  ssr: false,
});

export default function AccordionBests() {
  const [openRun, setOpenRun] = useState(true);

  return (
    <div className="space-y-3">
      {/* RUN */}
      <section className={[SURFACE_CARD].join(" ")}>
        <header
          onClick={() => setOpenRun((v) => !v)}
          className="px-4 py-3 cursor-pointer flex items-center justify-between select-none"
        >
          <h3 className="text-base font-semibold tracking-tight">
            Personal Bests — Running
          </h3>
          <span className="text-sm opacity-75">{openRun ? "▾" : "▸"}</span>
        </header>

        {openRun && (
          <div className="px-4 pb-4">
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
        <section key={title} className={SURFACE_SUBCARD}>
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
