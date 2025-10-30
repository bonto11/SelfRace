"use client";
import { useState } from "react";
import PBRun from "./PBRun";

export default function AccordionBests() {
  const [openRun, setOpenRun] = useState(true);

  return (
    <div className="space-y-2">
      <section className="bg-gray-800 rounded">
        <header
          className="px-3 py-2 cursor-pointer flex items-center justify-between"
          onClick={() => setOpenRun(v => !v)}
        >
          <h3 className="font-semibold">Personal Bests — Running</h3>
          <span>{openRun ? "▾" : "▸"}</span>
        </header>
        {openRun && (
          <div className="px-3 pb-3">
            <PBRun />
          </div>
        )}
      </section>

      {/* placeholders na ďalšie športy */}
      <section className="bg-gray-800 rounded opacity-70">
        <header className="px-3 py-2 flex items-center justify-between">
          <h3 className="font-semibold">Personal Bests — Cycling</h3>
          <span>soon</span>
        </header>
      </section>
    </div>
  );
}
