"use client";

import { useState } from "react";
import PBRun from "@/features/coach/components/PBRun";

export default function AccordionBests() {
  const [open, setOpen] = useState({ run: true, ride: false, strength: false });

  return (
    <div className="space-y-2">
      {/* RUN */}
      <section className="bg-gray-800 rounded">
        <header
          className="px-3 py-2 cursor-pointer flex items-center justify-between"
          onClick={() => setOpen((o) => ({ ...o, run: !o.run }))}
        >
          <h3 className="font-semibold">Personal Bests – Running</h3>
          <span>{open.run ? "▾" : "▸"}</span>
        </header>
        {open.run && (
          <div className="px-3 pb-3">
            <PBRun />
          </div>
        )}
      </section>

      {/* FUTURE SECTIONS */}
      <section className="bg-gray-800 rounded opacity-70">
        <header className="px-3 py-2 cursor-not-allowed flex items-center justify-between">
          <h3 className="font-semibold">Personal Bests – Cycling</h3>
          <span>soon</span>
        </header>
      </section>

      <section className="bg-gray-800 rounded opacity-70">
        <header className="px-3 py-2 cursor-not-allowed flex items-center justify-between">
          <h3 className="font-semibold">Personal Bests – Strength</h3>
          <span>soon</span>
        </header>
      </section>
    </div>
  );
}