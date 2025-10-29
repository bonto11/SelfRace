// src/app/(protected)/coach/prefs/ClientPage.tsx
"use client";

import { Suspense } from "react";
import { CoachDataProvider } from "@/features/coach/data/CoachDataProvider";
import CoachPrefsPanel from "@/features/coach/components/CoachPrefsPanel";
import AccordionBests from "@/features/coach/components/AccordionBests";

export default function ClientPage() {
  return (
    <CoachDataProvider>
      <div className="p-4 md:p-6 space-y-6">
        <h1 className="text-xl font-semibold">Coach · Preferences</h1>

        <Suspense fallback={<div className="opacity-70">Načítavam…</div>}>
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Detail preferencií */}
            <CoachPrefsPanel />

            {/* Personal Bests (zatiaľ RUN sekcia otvorená) */}
            <AccordionBests />
          </div>
        </Suspense>
      </div>
    </CoachDataProvider>
  );
}