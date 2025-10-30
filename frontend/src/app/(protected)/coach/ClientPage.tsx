// src/app/(protected)/coach/ClientPage.tsx
"use client";

import { CoachDataProvider } from "@/features/coach/data/CoachDataProvider";
import WidgetCoachPrefs from "@/features/widgets/WidgetCoachPrefs";
import WidgetPBRun from "@/features/widgets/WidgetPBRun";

export default function ClientPage() {
  return (
    <CoachDataProvider>
      <div className="p-4 md:p-6 space-y-6">
        <h1 className="text-xl font-semibold">Coach</h1>

        {/* 2 jednoduché widgety vedľa seba (na mobile pod sebou) */}
        <div className="grid gap-6 md:grid-cols-2">
          <WidgetCoachPrefs />
          <WidgetPBRun />
        </div>
      </div>
    </CoachDataProvider>
  );
}